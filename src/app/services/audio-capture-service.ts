import { Injectable, signal, DestroyRef, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private readonly destroyRef = inject(DestroyRef);

  readonly audioData = signal<Float32Array | null>(null);
  readonly frequency = signal<number | null>(null);
  readonly isCapturing = signal(false);

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private worker: Worker | null = null;

  private smoothedFrequency = 0;
  private readonly SMOOTHING_FACTOR = 0.1;
  private readonly CONFIDENCE_THRESHOLD = 0.25;

  constructor() {
    this.worker = new Worker(new URL('./pitch-detector.worker', import.meta.url));
    this.worker.onmessage = (event: MessageEvent<{ frequency: number | null; confidence: number }>) => {
      const { frequency, confidence } = event.data;

      if (frequency === null || confidence < this.CONFIDENCE_THRESHOLD) {
        this.frequency.set(null);
        this.smoothedFrequency = 0;
        return;
      }

      if (this.smoothedFrequency === 0) {
        this.smoothedFrequency = frequency;
      } else {
        this.smoothedFrequency += this.SMOOTHING_FACTOR * (frequency - this.smoothedFrequency);
      }
      this.frequency.set(this.smoothedFrequency);
    };

    this.destroyRef.onDestroy(() => {
      this.worker?.terminate();
      this.worker = null;
    });
  }

  async startCapture(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 8192;
    this.source.connect(this.analyser);

    this.isCapturing.set(true);
    this.readData();
  }

  stopCapture(): void {
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
    this.audioData.set(null);
    this.frequency.set(null);
    this.isCapturing.set(false);
  }

  private readData(): void {
    if (!this.analyser || !this.audioContext) return;

    const buffer = new Float32Array(this.analyser.fftSize);

    const tick = (): void => {
      if (!this.analyser || !this.audioContext) return;
      this.analyser.getFloatTimeDomainData(buffer);

      const displayLen = 256;
      const display = new Float32Array(displayLen);
      for (let i = 0; i < displayLen; i++) {
        display[i] = buffer[Math.floor((i * buffer.length) / displayLen)];
      }
      this.audioData.set(display);

      this.worker?.postMessage({
        buffer: buffer.slice(),
        sampleRate: this.audioContext.sampleRate,
      });

      this.animationFrameId = requestAnimationFrame(tick);
    };

    tick();
  }
}

