import { Service, signal, computed, DestroyRef, inject } from '@angular/core';

export type PitchTrackingState = 'idle' | 'listening' | 'locked';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

// ── Tuning constants ──────────────────────────────────────────────────
const ANALYSIS_INTERVAL_MS = 45;
const SMOOTHING_WINDOW = 3;
const EMA_ALPHA = 0.12;
const MAX_SMOOTHING_JUMP_CENTS = 380;

/**
 * When the worker returns "no pitch" for a silent input, we keep
 * displaying the last good pitch for this many frames before dropping
 * to 'listening'.
 */
const MAX_DROPOUT_HOLD_FRAMES = 6;

/**
 * A decaying string fails the confidence gate long before it goes
 * silent. While the input is still audible the pitch is not changing,
 * so keep displaying the last good pitch for up to this many frames
 * (~2.7 s at the analysis cadence) instead of blanking mid-decay.
 */
const AUDIBLE_HOLD_FRAMES = 60;

/**
 * Silence gate for dropout classification. Must stay in sync with
 * SILENCE_RMS in pitch-detector.worker: worker messages carry the raw
 * input level, and below this the input counts as true silence rather
 * than a decaying note.
 */
const SILENCE_RMS = 0.004;

const RELEASE_FRAME_COUNT = 10;

/**
 * Safety-net timeout (ms). If the worker hasn't replied within this
 * window we assume the message was lost and unblock the analysis loop.
 */
const ANALYSIS_TIMEOUT_MS = 500;

const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 1200;

@Service()
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  // ── Public signals ────────────────────────────────────────────
  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);
  readonly trackingState = signal<PitchTrackingState>('idle');
  readonly captureError = signal<string | null>(null);
  readonly inputLevel = signal(0);
  readonly debugInfo = computed(() => {
    const state = this.trackingState();
    const freq = this.frequency();
    const level = this.inputLevel();
    return `state: ${state} | freq: ${freq !== null ? `${freq.toFixed(1)} Hz` : 'null'} | level: ${level.toFixed(4)}`;
  });

  // ── Audio graph ───────────────────────────────────────────────
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;
  private analysisInFlight = false;
  private captureSession = 0;
  private startInFlight = false;

  // Watchdog that unblocks the loop if the worker never replies.
  private analysisTimeout: ReturnType<typeof setTimeout> | null = null;

  // Bound listener references so we can remove them on teardown.
  private onVisibilityChange: (() => void) | null = null;
  private onContextStateChange: (() => void) | null = null;
  // Context-unlock listeners ({once:true}) must also be removable in case
  // the context never reaches 'running' before capture is stopped.
  private onUnlockTouch: (() => void) | null = null;
  private onUnlockClick: (() => void) | null = null;

  // ── Smoothing / tracking state ────────────────────────────────
  private recentFrequencies: number[] = [];
  private smoothedFrequency: number | null = null;
  private emaFrequency: number | null = null;
  private missedFrames = 0;
  private pendingNoteFrequency: number | null = null;

  constructor() {
    this.worker = new Worker(
      new URL('./pitch-detector.worker', import.meta.url),
    );

    this.worker.onmessage = (event: MessageEvent<PitchAnalysisResponse>) => {
      const { frequency, confidence, inputLevel, sessionId } = event.data;
      if (!this.isCapturing() || sessionId !== this.captureSession) return;

      this.analysisInFlight = false;
      this.clearAnalysisTimeout();
      this.inputLevel.set(inputLevel);

      if (frequency === null || confidence <= 0) {
        this.handleDropout(inputLevel);
      } else {
        this.handleDetection(frequency);
      }
    };

    // Unblock the loop if the worker throws an unhandled error,
    // allowing the rAF tick to retry on the next frame.
    this.worker.onerror = (err: ErrorEvent) => {
      console.error('[AudioCaptureService] worker error:', err.message);
      this.analysisInFlight = false;
      this.clearAnalysisTimeout();
    };

    this.destroyRef.onDestroy(() => {
      this.stopCapture();
      this.worker?.terminate();
      this.worker = null;
    });
  }

  // ── Public API ────────────────────────────────────────────────

  async startCapture(): Promise<void> {
    if (this.isCapturing() || this.startInFlight) return;

    this.startInFlight = true;
    this.captureError.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      // Hint the browser to pick a small hardware buffer.
      const ctx = new AudioContext({ latencyHint: 'interactive' });

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Always register unlock listeners; remove them once the
      // context actually reaches 'running'. Covers iOS Safari where
      // the context can still be suspended after getUserMedia resolves.
      const unlock = (): void => {
        void ctx.resume();
      };
      this.onUnlockTouch = unlock;
      this.onUnlockClick = unlock;
      document.addEventListener('touchend', this.onUnlockTouch, { once: true });
      document.addEventListener('click', this.onUnlockClick, { once: true });
      ctx.addEventListener(
        'statechange',
        () => {
          if (ctx.state === 'running') {
            this.removeUnlockListeners();
          }
        },
        { once: true },
      );

      const source = ctx.createMediaStreamSource(this.stream);

      // Warn in dev if the OS ignored the channelCount hint.
      const trackSettings = this.stream.getAudioTracks()[0]?.getSettings();
      if (trackSettings && (trackSettings.channelCount ?? 1) > 1) {
        console.warn(
          '[AudioCaptureService] mic delivered multi-channel; forcing mono downmix.',
        );
      }

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 38;
      highpass.Q.value = 0.7;
      highpass.channelCount = 1;
      highpass.channelCountMode = 'explicit';

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1250;
      lowpass.Q.value = 0.7;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;            // Large window for low-freq resolution
      analyser.smoothingTimeConstant = 0; // We do our own smoothing

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      this.audioContext = ctx;
      this.analyser = analyser;
      this.source = source;
      this.highpass = highpass;
      this.lowpass = lowpass;

      this.captureSession += 1;
      this.resetTracking();
      this.isCapturing.set(true);
      this.trackingState.set('listening');
      this.scheduleAnalysis();

      // Auto-resume the context when the OS suspends it
      // (incoming call, notification shade, etc.).
      this.onContextStateChange = () => {
        if (ctx.state === 'suspended' && this.isCapturing()) {
          void ctx.resume();
        }
      };
      ctx.addEventListener('statechange', this.onContextStateChange);

      // Auto-resume when the user returns to the tab.
      this.onVisibilityChange = () => {
        if (document.visibilityState === 'visible' && this.isCapturing()) {
          void this.audioContext?.resume();
        }
      };
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    } catch {
      this.releaseAudioResources();
      this.captureError.set(
        'Microphone access is unavailable. Check browser permissions and try again.',
      );
      this.trackingState.set('idle');
    } finally {
      this.startInFlight = false;
    }
  }

  stopCapture(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAnalysisTimeout();
    this.captureSession += 1;
    this.analysisInFlight = false;
    this.startInFlight = false;
    this.releaseAudioResources();
    this.frequency.set(null);
    this.inputLevel.set(0);
    this.isCapturing.set(false);
    this.trackingState.set('idle');
    this.resetTracking();
  }

  // ── Audio lifecycle ───────────────────────────────────────────

  private releaseAudioResources(): void {
    // Tear down recovery listeners before the context is closed.
    if (this.onContextStateChange && this.audioContext) {
      this.audioContext.removeEventListener('statechange', this.onContextStateChange);
    }
    this.onContextStateChange = null;

    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.onVisibilityChange = null;

    this.removeUnlockListeners();

    this.source?.disconnect();
    this.highpass?.disconnect();
    this.lowpass?.disconnect();
    this.analyser?.disconnect();
    void this.audioContext?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.highpass = null;
    this.lowpass = null;
    this.stream = null;
  }

  private removeUnlockListeners(): void {
    if (this.onUnlockTouch) {
      document.removeEventListener('touchend', this.onUnlockTouch);
      this.onUnlockTouch = null;
    }
    if (this.onUnlockClick) {
      document.removeEventListener('click', this.onUnlockClick);
      this.onUnlockClick = null;
    }
  }

  private resetTracking(): void {
    this.recentFrequencies = [];
    this.smoothedFrequency = null;
    this.emaFrequency = null;
    this.missedFrames = 0;
    this.pendingNoteFrequency = null;
  }

  // ── Analysis loop ─────────────────────────────────────────────

  private scheduleAnalysis(): void {
    const buffer = new Float32Array(this.analyser!.fftSize);
    let lastAnalysisAt = Number.NEGATIVE_INFINITY;

    const tick = (timestamp: number): void => {
      if (!this.analyser || !this.audioContext) return;

      if (
        !this.analysisInFlight &&
        timestamp - lastAnalysisAt >= ANALYSIS_INTERVAL_MS
      ) {
        this.analyser.getFloatTimeDomainData(buffer);
        this.analysisInFlight = true;
        lastAnalysisAt = timestamp;

        this.worker?.postMessage({
          buffer: buffer.slice(),
          sampleRate: this.audioContext.sampleRate,
          sessionId: this.captureSession,
        });

        this.clearAnalysisTimeout();
        this.analysisTimeout = setTimeout(() => {
          this.analysisInFlight = false;
          this.analysisTimeout = null;
        }, ANALYSIS_TIMEOUT_MS);
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private clearAnalysisTimeout(): void {
    if (this.analysisTimeout !== null) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = null;
    }
  }

  // ── Frame handling ────────────────────────────────────────────

  private handleDetection(rawFrequency: number): void {
    this.missedFrames = 0;

    const smoothed = this.smoothFrequency(rawFrequency);

    if (this.recentFrequencies.length >= 3) {
      this.smoothedFrequency = smoothed;
      this.frequency.set(smoothed);
      this.trackingState.set('locked');
    } else {
      this.smoothedFrequency = null;
      this.frequency.set(null);
      this.trackingState.set('listening');
    }
  }

  private handleDropout(inputLevel: number): void {
    this.missedFrames += 1;
    const audible = inputLevel >= SILENCE_RMS;

    // Decay tail: the string is still ringing but the estimate no longer
    // clears the confidence gate. The pitch itself is not changing — hold
    // the display instead of blanking it mid-decay.
    if (audible && this.missedFrames <= AUDIBLE_HOLD_FRAMES) return;

    // Brief grace period for true silence before the needle is dropped.
    if (this.missedFrames <= MAX_DROPOUT_HOLD_FRAMES && this.smoothedFrequency !== null) {
      return;
    }

    // Sustained silence / untrusted input → release and reset tracking.
    if (this.missedFrames >= RELEASE_FRAME_COUNT) {
      this.resetTracking();
      this.frequency.set(null);
      this.trackingState.set('listening');
      return;
    }

    // Past the hold window: hide the frequency while tracking remains active.
    this.smoothedFrequency = null;
    this.emaFrequency = null;
    this.frequency.set(null);
  }

  // ── Hybrid Median + EMA Smoothing ──────────────────────────────

  private smoothFrequency(frequency: number): number {
    if (this.recentFrequencies.length > 0) {
      const med = this.median(this.recentFrequencies);
      const jump = Math.abs(this.cents(frequency, med));

      // Far frame: a single octave slip or transient blip must not move
      // the needle. Commit to a note change only after two consecutive
      // far frames that also agree with each other.
      if (jump > MAX_SMOOTHING_JUMP_CENTS) {
        const coherent =
          this.pendingNoteFrequency !== null &&
          Math.abs(this.cents(frequency, this.pendingNoteFrequency)) <= MAX_SMOOTHING_JUMP_CENTS;
        this.pendingNoteFrequency = frequency;

        if (!coherent) {
          return this.emaFrequency ?? this.median(this.recentFrequencies);
        }

        // Confirmed note change: seed a fresh consensus on the new note.
        this.pendingNoteFrequency = null;
        this.recentFrequencies = [frequency, frequency, frequency];
        this.emaFrequency = frequency;
        return frequency;
      }
      this.pendingNoteFrequency = null;
    }

    this.recentFrequencies.push(frequency);
    if (this.recentFrequencies.length > SMOOTHING_WINDOW) {
      this.recentFrequencies.shift();
    }

    const currentMedian = this.median(this.recentFrequencies);

    // Initial lock: seed the EMA directly from the initial consensus median.
    // Sustained tracking: blend via Exponential Moving Average (EMA) for rock-solid stability.
    if (this.emaFrequency === null || this.recentFrequencies.length < 3) {
      this.emaFrequency = currentMedian;
    } else {
      this.emaFrequency = EMA_ALPHA * currentMedian + (1 - EMA_ALPHA) * this.emaFrequency;
    }

    return this.emaFrequency;
  }

  // ── Math helpers ──────────────────────────────────────────────

  private median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  // Guard against non-positive inputs (would yield NaN/±Infinity).
  private cents(a: number, b: number): number {
    if (a <= 0 || b <= 0) return 0;
    return 1200 * Math.log2(a / b);
  }
}