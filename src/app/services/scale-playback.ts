import { DestroyRef, inject, InjectionToken, Service } from '@angular/core';
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

/** Single source of truth for MIDI → Hz lives in `pitch-utils`; re-exported here
 *  to preserve the existing public API of this module. */
export const midiToFrequency = midiNoteToFrequency;

@Service()
export class ScalePlayback {
  private readonly createAudioContext = inject(SCALE_AUDIO_CONTEXT_FACTORY);
  private readonly destroyRef = inject(DestroyRef);
  private context: AudioContext | null = null;

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

  private getContext(): AudioContext | null {
    this.context ??= this.createAudioContext();
    return this.context;
  }
}
