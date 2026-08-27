import { Service, signal, DestroyRef, inject } from '@angular/core';

export type PitchTrackingState = 'idle' | 'listening' | 'locked';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

const ANALYSIS_INTERVAL_MS = 45;
const SMOOTHING_WINDOW = 3;
const EMA_ALPHA = 0.12;
const MAX_SMOOTHING_JUMP_CENTS = 380;

const ADAPTIVE_ALPHA_CENTS = 100;

const MAX_DROPOUT_HOLD_FRAMES = 6;

const AUDIBLE_HOLD_FRAMES = 60;

const SILENCE_RMS = 0.004;

const ANALYSIS_TIMEOUT_MS = 500;

@Service()
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);
  readonly trackingState = signal<PitchTrackingState>('idle');
  readonly captureError = signal<string | null>(null);

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

  private analysisTimeout: ReturnType<typeof setTimeout> | null = null;

  private onVisibilityChange: (() => void) | null = null;
  private onContextStateChange: (() => void) | null = null;

  private onUnlockTouch: (() => void) | null = null;
  private onUnlockClick: (() => void) | null = null;

  private recentLogFreqs: number[] = [];
  private smoothedFrequency: number | null = null;
  private emaLogFreq: number | null = null;
  private missedFrames = 0;
  private pendingLogFreq: number | null = null;

  constructor() {
    this.worker = new Worker(new URL('./pitch-detector.worker', import.meta.url));

    this.worker.onmessage = (event: MessageEvent<PitchAnalysisResponse>) => {
      const { frequency, confidence, inputLevel, sessionId } = event.data;
      if (!this.isCapturing() || sessionId !== this.captureSession) return;

      this.analysisInFlight = false;
      this.clearAnalysisTimeout();

      if (frequency === null || confidence <= 0) {
        this.handleDropout(inputLevel);
      } else {
        this.handleDetection(frequency);
      }
    };

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

      const ctx = new AudioContext({ latencyHint: 'interactive' });

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

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

      const trackSettings = this.stream.getAudioTracks()[0]?.getSettings();
      if (trackSettings && (trackSettings.channelCount ?? 1) > 1) {
        console.warn('[AudioCaptureService] mic delivered multi-channel; forcing mono downmix.');
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
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;

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

      this.onContextStateChange = () => {
        if (ctx.state === 'suspended' && this.isCapturing()) {
          void ctx.resume();
        }
      };
      ctx.addEventListener('statechange', this.onContextStateChange);

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
    this.isCapturing.set(false);
    this.trackingState.set('idle');
    this.resetTracking();
  }

  private releaseAudioResources(): void {
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
    this.recentLogFreqs = [];
    this.smoothedFrequency = null;
    this.emaLogFreq = null;
    this.missedFrames = 0;
    this.pendingLogFreq = null;
  }

  private scheduleAnalysis(): void {
    const buffer = new Float32Array(this.analyser!.fftSize);
    let lastAnalysisAt = Number.NEGATIVE_INFINITY;

    const tick = (timestamp: number): void => {
      if (!this.analyser || !this.audioContext) return;

      if (!this.analysisInFlight && timestamp - lastAnalysisAt >= ANALYSIS_INTERVAL_MS) {
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

  private handleDetection(rawFrequency: number): void {
    this.missedFrames = 0;

    const smoothed = this.smoothFrequency(rawFrequency);
    if (smoothed === null) return;

    this.frequency.set(smoothed);

    if (this.recentLogFreqs.length >= 3) {
      this.smoothedFrequency = smoothed;
      this.trackingState.set('locked');
    } else {
      this.smoothedFrequency = smoothed;
      this.trackingState.set('listening');
    }
  }

  private handleDropout(inputLevel: number): void {
    this.missedFrames += 1;
    const audible = inputLevel >= SILENCE_RMS;

    if (audible && this.missedFrames <= AUDIBLE_HOLD_FRAMES) return;

    if (this.missedFrames <= MAX_DROPOUT_HOLD_FRAMES && this.smoothedFrequency !== null) {
      return;
    }

    this.resetTracking();
    this.frequency.set(null);
    this.trackingState.set('listening');
  }

  private smoothFrequency(frequency: number): number | null {
    if (!Number.isFinite(frequency) || frequency <= 0) {
      if (this.emaLogFreq !== null) return 2 ** this.emaLogFreq;
      if (this.recentLogFreqs.length > 0) return 2 ** this.median(this.recentLogFreqs);
      if (this.smoothedFrequency !== null) return this.smoothedFrequency;

      return null;
    }
    const candidateLog = Math.log2(frequency);

    if (this.recentLogFreqs.length > 0) {
      const medianLog = this.median(this.recentLogFreqs);

      const jumpCents = Math.abs((candidateLog - medianLog) * 1200);

      if (jumpCents > MAX_SMOOTHING_JUMP_CENTS) {
        const coherent =
          this.pendingLogFreq !== null &&
          Math.abs((candidateLog - this.pendingLogFreq) * 1200) <= MAX_SMOOTHING_JUMP_CENTS;
        this.pendingLogFreq = candidateLog;

        if (!coherent) {
          return this.emaLogFreq !== null
            ? 2 ** this.emaLogFreq
            : 2 ** this.median(this.recentLogFreqs);
        }

        this.pendingLogFreq = null;
        this.recentLogFreqs = [candidateLog, candidateLog, candidateLog];
        this.emaLogFreq = candidateLog;
        return frequency;
      }
      this.pendingLogFreq = null;
    }

    this.recentLogFreqs.push(candidateLog);
    if (this.recentLogFreqs.length > SMOOTHING_WINDOW) {
      this.recentLogFreqs.shift();
    }

    const currentMedianLog = this.median(this.recentLogFreqs);

    if (this.emaLogFreq === null || this.recentLogFreqs.length < 3) {
      this.emaLogFreq = currentMedianLog;
    } else {
      const innovationCents = Math.abs((currentMedianLog - this.emaLogFreq) * 1200);
      const alpha = Math.min(1, EMA_ALPHA + innovationCents / ADAPTIVE_ALPHA_CENTS);
      this.emaLogFreq = alpha * currentMedianLog + (1 - alpha) * this.emaLogFreq;
    }

    return 2 ** this.emaLogFreq;
  }

  private median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}
