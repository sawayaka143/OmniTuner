import { Service, signal, DestroyRef, inject, isDevMode } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AdaptiveNoiseGate } from './noise-gate';
import { DetectionRange, detectionRangeFor } from './pitch-detection';
import {
  CaptureDiagnostics,
  CaptureDiagnosticsTracker,
  RecordedSample,
  describeMic,
} from './capture-diagnostics';

export type PitchTrackingState = 'idle' | 'listening' | 'locked';

export type CaptureErrorCode = 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown';

const CAPTURE_ERROR_MESSAGES: Record<CaptureErrorCode, string> = {
  unsupported:
    "This browser can't access the microphone. Try the latest Chrome, Safari, Edge, or Firefox.",
  denied:
    'Microphone access was blocked. Allow it in your browser\u2019s site settings, then try again.',
  'not-found': 'No microphone was found. Connect one and try again.',
  'in-use': 'Your microphone is in use by another app. Close it and try again.',
  unknown: 'Microphone access is unavailable. Check browser permissions and try again.',
};

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  clarity?: number;
  candidateFrequency?: number | null;
  analysisMs?: number;
  sessionId: number;
  error?: string;
}

const ANALYSIS_INTERVAL_MS = 45;
const SMOOTHING_WINDOW = 3;
const EMA_ALPHA = 0.12;
const MAX_SMOOTHING_JUMP_CENTS = 380;

const ADAPTIVE_ALPHA_CENTS = 100;

const MAX_DROPOUT_HOLD_FRAMES = 6;

const AUDIBLE_HOLD_FRAMES = 60;

const HIGHPASS_STAGE_Q = [0.5412, 1.3066] as const;
const LOWPASS_FREQUENCY_HZ = 1800;

const ANALYSIS_TIMEOUT_MS = 500;

@Service()
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);
  readonly trackingState = signal<PitchTrackingState>('idle');
  readonly captureError = signal<string | null>(null);
  readonly captureErrorCode = signal<CaptureErrorCode | null>(null);
  readonly diagnostics = signal<CaptureDiagnostics | null>(null);

  readonly recordingProgress = signal<number | null>(null);

  private readonly diagnosticsTracker = new CaptureDiagnosticsTracker();
  private readonly noiseGate = new AdaptiveNoiseGate();
  private recording: {
    frames: Float32Array[];
    gates: number[];
    total: number;
    sampleRate: number;
    resolve: (sample: RecordedSample) => void;
    reject: (error: Error) => void;
  } | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private highpassStages: BiquadFilterNode[] = [];
  private detectionRange: DetectionRange = detectionRangeFor(null);
  private lowpass: BiquadFilterNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;
  private analysisInFlight = false;
  private captureSession = 0;
  private startInFlight = false;
  private userStopped = false;

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
      const { frequency, confidence, inputLevel, sessionId, error } = event.data;
      if (!this.isCapturing() || sessionId !== this.captureSession) return;

      this.analysisInFlight = false;
      this.clearAnalysisTimeout();
      this.recordDiagnostics(event.data);
      this.noiseGate.update(inputLevel, frequency !== null && confidence > 0);

      if (error && isDevMode()) {
        console.error('[AudioCaptureService] analysis failed:', error);
      }

      if (frequency === null || confidence <= 0) {
        this.handleDropout(inputLevel);
      } else {
        this.handleDetection(frequency);
      }
    };

    this.worker.onerror = (err: ErrorEvent) => {
      if (isDevMode()) console.error('[AudioCaptureService] worker error:', err.message);
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
    this.userStopped = false;
    this.captureError.set(null);
    this.captureErrorCode.set(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('microphone API unavailable'), {
          name: 'NotSupportedError',
        });
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      if (typeof AudioContext === 'undefined') {
        throw Object.assign(new Error('AudioContext unavailable'), { name: 'NotSupportedError' });
      }

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
      const splitter = ctx.createChannelSplitter(2);

      const highpassStages = HIGHPASS_STAGE_Q.map((q) => {
        const stage = ctx.createBiquadFilter();
        stage.type = 'highpass';
        stage.frequency.value = this.detectionRange.highpassHz;
        stage.Q.value = q;
        stage.channelCount = 1;
        stage.channelCountMode = 'explicit';
        return stage;
      });

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = LOWPASS_FREQUENCY_HZ;
      lowpass.Q.value = 0.7;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;

      source.connect(splitter);
      splitter.connect(highpassStages[0], 0);
      highpassStages[0].connect(highpassStages[1]);
      highpassStages[1].connect(lowpass);
      lowpass.connect(analyser);

      this.audioContext = ctx;
      this.analyser = analyser;
      this.source = source;
      this.splitter = splitter;
      this.highpassStages = highpassStages;
      this.lowpass = lowpass;

      this.captureSession += 1;
      this.resetTracking();
      this.noiseGate.reset();
      this.diagnosticsTracker.resetStats();
      this.diagnosticsTracker.setMic(describeMic(this.stream.getAudioTracks()[0], ctx.sampleRate));
      this.diagnostics.set(this.diagnosticsTracker.snapshot());
      this.isCapturing.set(true);
      this.trackingState.set('listening');
      void this.acquireKeepAwake();
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
    } catch (error) {
      this.releaseAudioResources();
      this.setCaptureError(this.captureErrorCodeFor(error));
      this.trackingState.set('idle');
    } finally {
      this.startInFlight = false;
    }
  }

  private setCaptureError(code: CaptureErrorCode): void {
    this.captureErrorCode.set(code);
    this.captureError.set(CAPTURE_ERROR_MESSAGES[code]);
    this.trackingState.set('idle');
  }

  private captureErrorCodeFor(error: unknown): CaptureErrorCode {
    const name = error instanceof Error ? error.name : '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'denied';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'not-found';
      case 'NotReadableError':
      case 'AbortError':
        return 'in-use';
      case 'NotSupportedError':
        return 'unsupported';
      default:
        return 'unknown';
    }
  }

  stopCapture(): void {
    this.userStopped = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAnalysisTimeout();
    this.captureSession += 1;
    this.analysisInFlight = false;
    this.startInFlight = false;
    this.abortRecording();
    void this.releaseKeepAwake();
    this.releaseAudioResources();
    this.frequency.set(null);
    this.isCapturing.set(false);
    this.trackingState.set('idle');
    this.resetTracking();
  }

  setLowestNote(frequencyHz: number | null): void {
    this.detectionRange = detectionRangeFor(frequencyHz);
    this.highpassStages.forEach((stage) => {
      stage.frequency.value = this.detectionRange.highpassHz;
    });
    this.diagnosticsTracker.setRange(this.detectionRange);
    this.diagnostics.update((current) => (current ? this.diagnosticsTracker.snapshot() : current));
  }

  resetDiagnostics(): void {
    this.diagnosticsTracker.resetStats();
    this.diagnostics.set(this.diagnosticsTracker.snapshot());
  }

  recordSample(frameCount: number): Promise<RecordedSample> {
    if (!this.isCapturing() || !this.audioContext) {
      return Promise.reject(new Error('Start the tuner before recording a sample.'));
    }
    this.abortRecording();
    const sampleRate = this.audioContext.sampleRate;
    return new Promise<RecordedSample>((resolve, reject) => {
      this.recording = { frames: [], gates: [], total: frameCount, sampleRate, resolve, reject };
      this.recordingProgress.set(0);
    });
  }

  private captureRecordingFrame(frame: Float32Array, gate: number): void {
    const recording = this.recording;
    if (!recording) return;

    recording.frames.push(frame);
    recording.gates.push(gate);
    this.recordingProgress.set(recording.frames.length / recording.total);

    if (recording.frames.length >= recording.total) {
      this.recording = null;
      this.recordingProgress.set(null);
      recording.resolve({
        frames: recording.frames,
        gates: recording.gates,
        sampleRate: recording.sampleRate,
        frameSize: frame.length,
        hopMs: ANALYSIS_INTERVAL_MS,
        range: this.detectionRange,
      });
    }
  }

  private abortRecording(): void {
    const recording = this.recording;
    if (!recording) return;
    this.recording = null;
    this.recordingProgress.set(null);
    recording.reject(new Error('Recording stopped before it finished.'));
  }

  private recordDiagnostics(response: PitchAnalysisResponse): void {
    this.diagnosticsTracker.record({
      inputLevel: response.inputLevel,
      clarity: response.clarity ?? null,
      candidateFrequency: response.candidateFrequency ?? null,
      accepted: response.frequency !== null && response.confidence > 0,
      analysisMs: response.analysisMs ?? null,
      receivedAt: performance.now(),
      gate: this.noiseGate.gate,
      noiseFloor: this.noiseGate.noiseFloor,
    });
    this.diagnostics.set(this.diagnosticsTracker.snapshot());
  }

  attemptAutoStart(): void {
    if (this.isCapturing() || this.startInFlight || this.userStopped) return;
    void this.startCapture();
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
    this.splitter?.disconnect();
    this.highpassStages.forEach((stage) => stage.disconnect());
    this.lowpass?.disconnect();
    this.analyser?.disconnect();
    void this.audioContext?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.splitter = null;
    this.highpassStages = [];
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

  private async acquireKeepAwake(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await KeepAwake.keepAwake();
    } catch {}
  }

  private async releaseKeepAwake(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await KeepAwake.allowSleep();
    } catch {}
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

        const frame = buffer.slice();
        const silenceGate = this.noiseGate.gate;
        this.worker?.postMessage({
          buffer: frame,
          sampleRate: this.audioContext.sampleRate,
          silenceGate,
          minFrequency: this.detectionRange.minFrequency,
          sessionId: this.captureSession,
        });
        this.captureRecordingFrame(frame, silenceGate);

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
    const audible = inputLevel >= this.noiseGate.gate;

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
