import { Service, signal, computed, DestroyRef, inject } from '@angular/core';

export type PitchTrackingState = 'idle' | 'listening' | 'locked';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

// ── Tuning constants ──────────────────────────────────────────────────
// Grouped here so you can experiment without digging through logic.

/** How often we read the analyser and post to the worker (ms). */
const ANALYSIS_INTERVAL_MS = 45;

/**
 * Median filter window size (frames).
 * 3 frames provides rapid impulse/outlier rejection without phase lag.
 */
const SMOOTHING_WINDOW = 3;

/**
 * Exponential Moving Average (EMA) smoothing coefficient.
 * Damps continuous micro-jitter for a rock-solid needle and cents display.
 */
const EMA_ALPHA = 0.12;

/**
 * If a new frame is more than this many cents away from the running
 * median, we assume it's a genuine note change (or gross error)
 * and reset the smoothing window instead of blending it in.
 */
const MAX_SMOOTHING_JUMP_CENTS = 380;

/**
 * When the worker returns "no pitch", we keep displaying the last
 * good pitch for this many frames before dropping to 'listening'.
 * Prevents the needle from vanishing during note decay.
 */
const MAX_DROPOUT_HOLD_FRAMES = 6;

const RELEASE_FRAME_COUNT = 10;

/**
 * Safety-net timeout (ms).  If the worker hasn't replied within this
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

  // #7 – watchdog that unblocks the loop if the worker never replies.
  private analysisTimeout: ReturnType<typeof setTimeout> | null = null;

  // #2 – bound listener references so we can remove them on teardown.
  private onVisibilityChange: (() => void) | null = null;
  private onContextStateChange: (() => void) | null = null;
  // #2 – context-unlock listeners ({once:true}) must also be removable in case
  // the context never reaches 'running' before capture is stopped.
  private onUnlockTouch: (() => void) | null = null;
  private onUnlockClick: (() => void) | null = null;

  // ── Smoothing / tracking state ────────────────────────────────
  private recentFrequencies: number[] = [];
  private smoothedFrequency: number | null = null;
  private emaFrequency: number | null = null;
  private missedFrames = 0;

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
        this.handleDropout();
      } else {
        this.handleDetection(frequency);
      }
    };

    // #6 – if the worker throws an unhandled error, unblock the loop
    // so the rAF tick can retry on the next frame.
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

      // #11 – hint the browser to pick a small hardware buffer.
      const ctx = new AudioContext({ latencyHint: 'interactive' });

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // #3 – always register unlock listeners; remove them once the
      // context actually reaches 'running'.  Covers iOS Safari where
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

      // #4 – warn in dev if the OS ignored the channelCount hint.
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
      highpass.channelCount = 1;                            // #4
      highpass.channelCountMode = 'explicit';               // #4

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1250;
      lowpass.Q.value = 0.7;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;            // large window for low-freq resolution
      analyser.smoothingTimeConstant = 0; // we do our own smoothing

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

      // #2 – auto-resume the context when the OS suspends it
      // (incoming call, notification shade, etc.).
      this.onContextStateChange = () => {
        if (ctx.state === 'suspended' && this.isCapturing()) {
          void ctx.resume();
        }
      };
      ctx.addEventListener('statechange', this.onContextStateChange);

      // #2 – auto-resume when the user returns to the tab.
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
    // #2 – tear down recovery listeners before the context is closed.
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

  // #7
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

  private handleDropout(): void {
    this.missedFrames += 1;

    // Hold the current locked pitch through momentary frame dropouts
    // as the string naturally decays.
    if (this.smoothedFrequency !== null && this.missedFrames <= MAX_DROPOUT_HOLD_FRAMES) {
      return;
    }

    // Sustained silence → release and reset tracking state.
    if (this.missedFrames >= RELEASE_FRAME_COUNT) {
      this.resetTracking();
      this.frequency.set(null);
      this.trackingState.set('listening');
      return;
    }

    // Past the hold window: hide the frequency while tracking remains active.
    if (this.missedFrames > MAX_DROPOUT_HOLD_FRAMES) {
      this.smoothedFrequency = null;
      this.emaFrequency = null;
      this.frequency.set(null);
    }
  }

  // ── Hybrid Median + EMA Smoothing ──────────────────────────────

  private smoothFrequency(frequency: number): number {
    if (this.recentFrequencies.length > 0) {
      const med = this.median(this.recentFrequencies);
      const jump = Math.abs(this.cents(frequency, med));

      // Intentional note change: reset history so the new note starts fresh.
      if (jump > MAX_SMOOTHING_JUMP_CENTS) {
        this.recentFrequencies = [frequency];
        this.emaFrequency = frequency;
        return frequency;
      }
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

  // #9 – guard against non-positive inputs (would yield NaN/±Infinity).
  private cents(a: number, b: number): number {
    if (a <= 0 || b <= 0) return 0;
    return 1200 * Math.log2(a / b);
  }
}