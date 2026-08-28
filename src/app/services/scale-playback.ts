import { DestroyRef, inject, InjectionToken, Service, signal } from '@angular/core';
import { guitarSamplePlaybackRate, nearestGuitarSample } from '../data/guitar-samples';
import { midiNoteToFrequency } from '../utils/pitch-utils';

export type AudioContextFactory = () => AudioContext | null;

export const SCALE_AUDIO_CONTEXT_FACTORY = new InjectionToken<AudioContextFactory>(
  'Scale audio context factory',
  {
    factory: () => () => {
      try {
        return new AudioContext();
      } catch {
        return null;
      }
    },
  },
);

export const midiToFrequency = midiNoteToFrequency;

const GUITAR_SAMPLE_BASE_URL = 'audio/guitar/';

@Service()
export class ScalePlayback {
  private readonly createAudioContext = inject(SCALE_AUDIO_CONTEXT_FACTORY);
  private readonly destroyRef = inject(DestroyRef);
  private context: AudioContext | null = null;
  private readonly sampleCache = new Map<string, AudioBuffer>();

  readonly isPlaying = signal(false);

  readonly error = signal<string | null>(null);

  clearError(): void {
    this.error.set(null);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.context && this.context.state !== 'closed') void this.context.close();
      this.context = null;
    });
  }

  createGain(): GainNode | null {
    const context = this.getContext();
    if (!context) return null;
    try {
      const gain = context.createGain();
      gain.connect(context.destination);
      return gain;
    } catch {
      this.error.set('Audio playback was interrupted. Tap again to retry.');
      return null;
    }
  }

  playNote(midi: number, delaySeconds = 0, durationSeconds = 0.55, destination?: AudioNode): void {
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended')
      void context.resume().catch(() => {
        this.error.set('Audio playback was blocked. Tap again to retry.');
      });

    let oscillator: OscillatorNode;
    let gain: GainNode;
    let lowPass: BiquadFilterNode;
    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
      lowPass = context.createBiquadFilter();
    } catch {
      this.error.set('Audio playback was interrupted. Tap again to retry.');
      return;
    }
    const startAt = context.currentTime + Math.max(0, delaySeconds);
    const duration = Math.max(0.08, durationSeconds);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(midiToFrequency(midi), startAt);
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(2600, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.22, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(destination ?? context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.05);
  }

  playChime(): void {
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended')
      void context.resume().catch(() => {
        this.error.set('Audio playback was blocked. Tap again to retry.');
      });

    const startAt = context.currentTime;
    this.playTone(context, midiToFrequency(69), startAt, 0.12, 0.65);
    this.playTone(context, midiToFrequency(76), startAt + 0.06, 0.08, 0.7);
  }

  playSampleNote(
    midi: number,
    delaySeconds = 0,
    durationSeconds?: number,
    destination?: AudioNode,
  ): void {
    const context = this.getContext();
    if (!context) return;

    const sample = nearestGuitarSample(midi);
    if (!sample) {
      this.playNote(midi, delaySeconds, durationSeconds ?? 0.55, destination);
      return;
    }

    const buffer = this.sampleCache.get(sample.file);
    if (!buffer) {
      void this.loadGuitarSample(sample.file)
        .then((loaded) => {
          if (loaded) this.playSampleNote(midi, delaySeconds, durationSeconds, destination);
        })
        .catch(() => this.playNote(midi, delaySeconds, durationSeconds ?? 0.55, destination));
      return;
    }

    if (context.state === 'suspended')
      void context.resume().catch(() => {
        this.error.set('Audio playback was blocked. Tap again to retry.');
      });

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = guitarSamplePlaybackRate(midi, sample.rootMidi);

    const gain = context.createGain();
    const startAt = context.currentTime + Math.max(0, delaySeconds);
    const duration = durationSeconds ?? Math.min(1.6, Math.max(0.6, buffer.duration));
    const endAt = startAt + duration;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.9, startAt + 0.008);
    gain.gain.setValueAtTime(0.9, Math.max(startAt + 0.008, endAt - 0.06));
    gain.gain.linearRampToValueAtTime(0.0001, endAt);

    source.connect(gain);
    gain.connect(destination ?? context.destination);
    source.start(startAt);
    source.stop(endAt + 0.05);
  }

  private async loadGuitarSample(file: string): Promise<AudioBuffer> {
    const context = this.getContext();
    if (!context) throw new Error('no audio context');

    const cached = this.sampleCache.get(file);
    if (cached) return cached;

    const response = await fetch(GUITAR_SAMPLE_BASE_URL + file);
    if (!response.ok) throw new Error(`sample fetch failed: ${file}`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    this.sampleCache.set(file, buffer);
    return buffer;
  }

  private playTone(
    context: AudioContext,
    frequency: number,
    startAt: number,
    peakGain: number,
    duration: number,
  ): void {
    let oscillator: OscillatorNode;
    let gain: GainNode;
    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
    } catch {
      this.error.set('Audio playback was interrupted. Tap again to retry.');
      return;
    }
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.05);
  }

  private getContext(): AudioContext | null {
    if (this.context?.state === 'closed') this.context = null;
    if (!this.context) {
      this.context = this.createAudioContext();
      this.error.set(this.context ? null : 'Audio playback is unavailable in this browser.');
    }
    return this.context;
  }
}
