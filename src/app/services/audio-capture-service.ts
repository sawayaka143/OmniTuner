import { Injectable, signal, DestroyRef, inject } from '@angular/core';

export type PitchTrackingState = 'idle' | 'listening' | 'locked';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  sessionId: number;
}

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);
  readonly trackingState = signal<PitchTrackingState>('idle');
  readonly captureError = signal<string | null>(null);

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private inputFilter: BiquadFilterNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;
  private analysisInFlight = false;
  private captureSession = 0;

  private smoothedFrequency = 0;
  private recentFrequencies: number[] = [];
  private candidateFrequencies: number[] = [];
  private rejectedFrameCount = 0;

  private readonly SMOOTHING_FACTOR = 0.1;
  private readonly CONFIDENCE_THRESHOLD = 0.68;
  private readonly MEDIAN_WINDOW = 5;
  private readonly ANALYSIS_INTERVAL_MS = 40;
  private readonly HIGH_PASS_FREQUENCY = 55;
  private readonly CANDIDATE_FRAME_COUNT = 3;
  private readonly CANDIDATE_TOLERANCE_CENTS = 35;
  private readonly LOCKED_TRACKING_TOLERANCE_CENTS = 125;
  private readonly RELEASE_FRAME_COUNT = 8;

  constructor() {
    this.worker = new Worker(new URL('./pitch-detector.worker', import.meta.url));
    this.worker.onmessage = (event: MessageEvent<PitchAnalysisResponse>) => {
      const { frequency, confidence, sessionId } = event.data;
      if (!this.isCapturing() || sessionId !== this.captureSession) return;

      this.analysisInFlight = false;
      if (frequency === null || confidence < this.CONFIDENCE_THRESHOLD) {
        this.handleRejectedFrame();
        return;
      }

      this.handleReliableFrame(frequency);
    };

    this.destroyRef.onDestroy(() => {
      this.stopCapture();
      this.worker?.terminate();
      this.worker = null;
    });
  }

  async startCapture(): Promise<void> {
    if (this.isCapturing()) return;

    this.captureError.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.inputFilter = this.audioContext.createBiquadFilter();
      this.inputFilter.type = 'highpass';
      this.inputFilter.frequency.value = this.HIGH_PASS_FREQUENCY;
      this.inputFilter.Q.value = 0.707;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      this.source.connect(this.inputFilter);
      this.inputFilter.connect(this.analyser);
      this.captureSession += 1;
      this.resetTracking();
      this.isCapturing.set(true);
      this.trackingState.set('listening');
      this.readData();
    } catch {
      this.releaseAudioResources();
      this.captureError.set('Microphone access is unavailable. Check browser permissions and try again.');
      this.trackingState.set('idle');
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

  private releaseAudioResources(): void {
    this.source?.disconnect();
    this.inputFilter?.disconnect();
    this.analyser?.disconnect();
    void this.audioContext?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.inputFilter = null;
    this.stream = null;
  }

  private resetTracking(): void {
    this.smoothedFrequency = 0;
    this.recentFrequencies = [];
    this.candidateFrequencies = [];
    this.rejectedFrameCount = 0;
  }

  private medianFilter(frequency: number): number {
    this.recentFrequencies.push(frequency);
    if (this.recentFrequencies.length > this.MEDIAN_WINDOW) {
      this.recentFrequencies.shift();
    }
    return this.median(this.recentFrequencies);
  }

  private handleReliableFrame(frequency: number): void {
    this.rejectedFrameCount = 0;

    if (this.trackingState() !== 'locked') {
      this.considerCandidate(frequency);
      return;
    }

    const medianFrequency = this.medianFilter(frequency);
    if (this.centsDistance(medianFrequency, this.smoothedFrequency) > this.LOCKED_TRACKING_TOLERANCE_CENTS) {
      this.recentFrequencies = [];
      this.considerCandidate(frequency);
      return;
    }

    this.candidateFrequencies = [];
    this.smoothedFrequency = this.smoothInLogSpace(medianFrequency);
    this.frequency.set(this.smoothedFrequency);
  }

  private considerCandidate(frequency: number): void {
    const candidateMedian = this.candidateFrequencies.length > 0
      ? this.median(this.candidateFrequencies)
      : null;

    if (
      candidateMedian === null ||
      this.centsDistance(frequency, candidateMedian) > this.CANDIDATE_TOLERANCE_CENTS
    ) {
      this.candidateFrequencies = [frequency];
      return;
    }

    this.candidateFrequencies.push(frequency);
    if (this.candidateFrequencies.length < this.CANDIDATE_FRAME_COUNT) return;

    const lockedFrequency = this.median(this.candidateFrequencies);
    this.smoothedFrequency = lockedFrequency;
    this.recentFrequencies = [lockedFrequency];
    this.candidateFrequencies = [];
    this.frequency.set(lockedFrequency);
    this.trackingState.set('locked');
  }

  private handleRejectedFrame(): void {
    this.candidateFrequencies = [];
    if (this.trackingState() !== 'locked') return;

    this.rejectedFrameCount += 1;
    if (this.rejectedFrameCount < this.RELEASE_FRAME_COUNT) return;

    this.frequency.set(null);
    this.trackingState.set('listening');
    this.resetTracking();
  }

  private smoothInLogSpace(frequency: number): number {
    if (this.smoothedFrequency === 0) return frequency;

    const currentLogFrequency = Math.log2(this.smoothedFrequency);
    const incomingLogFrequency = Math.log2(frequency);
    return 2 ** (
      currentLogFrequency + this.SMOOTHING_FACTOR * (incomingLogFrequency - currentLogFrequency)
    );
  }

  private median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private centsDistance(a: number, b: number): number {
    return Math.abs(1200 * Math.log2(a / b));
  }

  private readData(): void {
    if (!this.analyser || !this.audioContext) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    let lastAnalysisAt = Number.NEGATIVE_INFINITY;
    const tick = (timestamp: number): void => {
      if (!this.analyser || !this.audioContext) return;
      if (!this.analysisInFlight && timestamp - lastAnalysisAt >= this.ANALYSIS_INTERVAL_MS) {
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
}
