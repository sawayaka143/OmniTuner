import { Injectable, signal, DestroyRef, inject } from '@angular/core';

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
 * Median-smoothing window.  5 frames at ~45 ms ≈ 225 ms of history.
 * Large enough to kill jitter, small enough to follow a bend.
 */
const SMOOTHING_WINDOW = 5;

/**
 * If a new frame is more than this many cents away from the running
 * median, we assume it's a genuine note change (or a gross error)
 * and reset the smoothing window instead of blending it in.
 */
const MAX_SMOOTHING_JUMP_CENTS = 380;

/**
 * If the raw frequency jumps more than this from the recent median,
 * we try octave-shifted candidates (×2, ÷2) and pick the closest
 * one — but only accept the correction if it lands within
 * OCTAVE_CORRECTION_CENTS of the median.
 */
const OCTAVE_JUMP_CENTS = 650;
const OCTAVE_CORRECTION_CENTS = 360;

/**
 * When the worker returns "no pitch", we keep displaying the last
 * good pitch for this many frames before dropping to 'listening'.
 * Prevents the needle from vanishing on every single missed frame.
 */
const MAX_DROPOUT_HOLD_FRAMES = 3;

/**
 * After this many consecutive dropouts we fully reset and go back
 * to 'listening'.
 */
const RELEASE_FRAME_COUNT = 8;

const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 900;

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  // ── Public signals (unchanged API) ──────────────────────────────
  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);
  readonly trackingState = signal<PitchTrackingState>('idle');
  readonly captureError = signal<string | null>(null);

  // ── Audio graph ─────────────────────────────────────────────────
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

  // ── Smoothing / tracking state ─────────────────────────────────
  private recentFrequencies: number[] = [];
  private smoothedFrequency: number | null = null;
  private missedFrames = 0;

  constructor() {
    this.worker = new Worker(
      new URL('./pitch-detector.worker', import.meta.url),
    );
    this.worker.onmessage = (event: MessageEvent<PitchAnalysisResponse>) => {
      const { frequency, confidence, sessionId } = event.data;
      if (!this.isCapturing() || sessionId !== this.captureSession) return;

      this.analysisInFlight = false;

      if (frequency === null || confidence <= 0) {
        this.handleDropout();
      } else {
        this.handleDetection(frequency);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.stopCapture();
      this.worker?.terminate();
      this.worker = null;
    });
  }

  // ── Public API (unchanged) ──────────────────────────────────────

  async startCapture(): Promise<void> {
    if (this.isCapturing() || this.startInFlight) return;

    this.startInFlight = true;
    this.captureError.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,   // browser NS distorts pitch
          autoGainControl: false,
        },
      });

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(this.stream);

      // Highpass: kill rumble / handling noise below the guitar range.
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 38;
      highpass.Q.value = 0.7;

      // Lowpass: remove high-frequency noise and upper harmonics that
      // confuse YIN.  1250 Hz keeps all guitar fundamentals and enough
      // harmonic content for reliable detection.
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
    this.captureSession += 1;
    this.analysisInFlight = false;
    this.releaseAudioResources();
    this.frequency.set(null);
    this.isCapturing.set(false);
    this.trackingState.set('idle');
    this.resetTracking();
  }

  // ── Audio lifecycle ─────────────────────────────────────────────

  private releaseAudioResources(): void {
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

  private resetTracking(): void {
    this.recentFrequencies = [];
    this.smoothedFrequency = null;
    this.missedFrames = 0;
  }

  // ── Analysis loop ───────────────────────────────────────────────

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
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  // ── Frame handling ──────────────────────────────────────────────

  private handleDetection(rawFrequency: number): void {
    this.missedFrames = 0;

    // 1. Octave correction: if the raw frequency jumped by more than
    //    ~650 cents from our running median, try ÷2 and ×2 and pick
    //    the candidate closest to the median.
    const corrected = this.correctOctaveJump(rawFrequency);

    // 2. Median smoothing with a large-jump reset.
    const smoothed = this.smoothFrequency(corrected);

    this.smoothedFrequency = smoothed;
    this.frequency.set(smoothed);
    this.trackingState.set('locked');
  }

  private handleDropout(): void {
    this.missedFrames += 1;

    // Hold the last good pitch for a few frames so the needle
    // doesn't flicker out on every momentary YIN miss.
    if (this.smoothedFrequency !== null && this.missedFrames <= MAX_DROPOUT_HOLD_FRAMES) {
      // Keep displaying the last pitch; don't update the signal.
      return;
    }

    // Sustained silence → release.
    if (this.missedFrames >= RELEASE_FRAME_COUNT) {
      this.smoothedFrequency = null;
      this.recentFrequencies = [];
      this.frequency.set(null);
      this.trackingState.set('listening');
      return;
    }

    // Between MAX_DROPOUT_HOLD and RELEASE: stop displaying but
    // stay 'locked' so we don't flash "LISTENING" on every pause.
    if (this.missedFrames > MAX_DROPOUT_HOLD_FRAMES) {
      this.frequency.set(null);
    }
  }

  // ── Octave correction ───────────────────────────────────────────

  private correctOctaveJump(frequency: number): number {
    if (this.recentFrequencies.length === 0) return frequency;

    const reference = this.median(this.recentFrequencies);
    const jumpCents = Math.abs(this.cents(frequency, reference));

    if (jumpCents < OCTAVE_JUMP_CENTS) return frequency;

    // Try the frequency as-is, one octave down, and one octave up.
    const candidates = [frequency, frequency / 2, frequency * 2].filter(
      (f) => f >= MIN_FREQUENCY && f <= MAX_FREQUENCY,
    );

    const best = candidates.reduce((closest, candidate) =>
      Math.abs(this.cents(candidate, reference)) <
      Math.abs(this.cents(closest, reference))
        ? candidate
        : closest,
    );

    // Only accept the correction if it's reasonably close.
    return Math.abs(this.cents(best, reference)) < OCTAVE_CORRECTION_CENTS
      ? best
      : frequency;
  }

  // ── Median smoothing ────────────────────────────────────────────

  private smoothFrequency(frequency: number): number {
    if (this.recentFrequencies.length > 0) {
      const med = this.median(this.recentFrequencies);
      const jump = Math.abs(this.cents(frequency, med));


      if (jump > MAX_SMOOTHING_JUMP_CENTS) {
        this.recentFrequencies = [frequency];
        return frequency;
      }
    }

    this.recentFrequencies.push(frequency);
    if (this.recentFrequencies.length > SMOOTHING_WINDOW) {
      this.recentFrequencies.shift();
    }

    return this.median(this.recentFrequencies);
  }

  // ── Math helpers ────────────────────────────────────────────────

  private median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private cents(a: number, b: number): number {
    return 1200 * Math.log2(a / b);
  }
}