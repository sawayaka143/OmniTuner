import { Injectable, signal, DestroyRef, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;

  private smoothedFrequency = 0;
  private recentFrequencies: number[] = [];

  private readonly SMOOTHING_FACTOR = 0.1;
  private readonly CONFIDENCE_THRESHOLD = 0.3;
  private readonly MEDIAN_WINDOW = 5;

  constructor() {
    this.worker = new Worker(new URL('./pitch-detector.worker', import.meta.url));
    this.worker.onmessage = (event: MessageEvent<{ frequency: number | null; confidence: number }>) => {
      if (!this.isCapturing()) return;

      const { frequency, confidence } = event.data;
      if (frequency === null || confidence < this.CONFIDENCE_THRESHOLD) {
        this.frequency.set(null);
        this.smoothedFrequency = 0;
        this.recentFrequencies = [];
        return;
      }

      const medianFrequency = this.medianFilter(frequency);
      if (this.smoothedFrequency === 0) {
        this.smoothedFrequency = medianFrequency;
      } else {
        this.smoothedFrequency += this.SMOOTHING_FACTOR * (medianFrequency - this.smoothedFrequency);
      }
      this.frequency.set(this.smoothedFrequency);
    };

    this.destroyRef.onDestroy(() => {
      this.stopCapture();
      this.worker?.terminate();
      this.worker = null;
    });
  }

  async startCapture(): Promise<void> {
    if (this.isCapturing()) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096;
    this.source.connect(this.analyser);
    this.isCapturing.set(true);
    this.readData();
  }

  stopCapture(): void {
    if (!this.isCapturing()) return;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.source?.disconnect();
    this.audioContext?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.frequency.set(null);
    this.isCapturing.set(false);
    this.smoothedFrequency = 0;
    this.recentFrequencies = [];
  }

  private medianFilter(frequency: number): number {
    this.recentFrequencies.push(frequency);
    if (this.recentFrequencies.length > this.MEDIAN_WINDOW) {
      this.recentFrequencies.shift();
    }
    const sorted = [...this.recentFrequencies].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private readData(): void {
    if (!this.analyser || !this.audioContext) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    const tick = (): void => {
      if (!this.analyser || !this.audioContext) return;
      this.analyser.getFloatTimeDomainData(buffer);
      this.worker?.postMessage({
        buffer: buffer.slice(),
        sampleRate: this.audioContext.sampleRate,
      });
      this.animationFrameId = requestAnimationFrame(tick);
    };
    tick();
  }
}