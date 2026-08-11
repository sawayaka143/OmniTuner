import { DestroyRef, inject, InjectionToken, Service, signal } from '@angular/core';
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

/** MIDI → Hz, re-exported from `pitch-utils` to preserve this module's public API. */
export const midiToFrequency = midiNoteToFrequency;

@Service()
export class ScalePlayback {
  private readonly createAudioContext = inject(SCALE_AUDIO_CONTEXT_FACTORY);
  private readonly destroyRef = inject(DestroyRef);
  private context: AudioContext | null = null;

  /** True while a scale/tuning sequence is playing (drives the brand wobble). */
  readonly isPlaying = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.context && this.context.state !== 'closed') void this.context.close();
      this.context = null;
    });
  }

  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  createGain(): GainNode | null {
    const context = this.getContext();
    if (!context) return null;
    const gain = context.createGain();
    gain.connect(context.destination);
    return gain;
  }

  playNote(midi: number, delaySeconds = 0, durationSeconds = 0.55, destination?: AudioNode): void {
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const lowPass = context.createBiquadFilter();
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

  /**
   * Soft confirmation chime for the in-tune lock: a low-register perfect
   * fifth (A4 + E5) with a gentle envelope, so it reads as a confirmation
   * blip rather than a stray high note.
   */
  playChime(): void {
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();

    const startAt = context.currentTime;
    this.playTone(context, midiToFrequency(69), startAt, 0.12, 0.65);
    this.playTone(context, midiToFrequency(76), startAt + 0.06, 0.08, 0.7);
  }

  private playTone(
    context: AudioContext,
    frequency: number,
    startAt: number,
    peakGain: number,
    duration: number,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
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
    this.context ??= this.createAudioContext();
    return this.context;
  }
}
