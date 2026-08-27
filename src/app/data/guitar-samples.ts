export interface GuitarSample {
  readonly file: string;
  readonly rootMidi: number;
}

export const GUITAR_SAMPLE_MIN_MIDI = 37;

export const GUITAR_SAMPLE_MAX_MIDI = 86;

export const GUITAR_SAMPLES: readonly GuitarSample[] = [
  { file: 'db2_mf_rr1.wav', rootMidi: 37 },
  { file: 'e2_mf_rr1.wav', rootMidi: 40 },
  { file: 'gb2_mf_rr1.wav', rootMidi: 42 },
  { file: 'a2_mf_rr1.wav', rootMidi: 45 },
  { file: 'c3_mf_rr1.wav', rootMidi: 48 },
  { file: 'eb3_mf_rr1.wav', rootMidi: 51 },
  { file: 'gb3_mf_rr1.wav', rootMidi: 54 },
  { file: 'a3_mf_rr1.wav', rootMidi: 57 },
  { file: 'c4_mf_rr1.wav', rootMidi: 60 },
  { file: 'eb4_mf_rr1.wav', rootMidi: 63 },
  { file: 'gb4_mf_rr1.wav', rootMidi: 66 },
  { file: 'a4_mf_rr1.wav', rootMidi: 69 },
  { file: 'c5_mf_rr1.wav', rootMidi: 72 },
  { file: 'eb5_mf_rr1.wav', rootMidi: 75 },
  { file: 'gb5_mf_rr1.wav', rootMidi: 78 },
  { file: 'a5_mf_rr1.wav', rootMidi: 81 },
  { file: 'c6_mf_rr1.wav', rootMidi: 84 },
  { file: 'd6_mf_rr1.wav', rootMidi: 86 },
];

export function nearestGuitarSample(midi: number): GuitarSample | null {
  if (midi < GUITAR_SAMPLE_MIN_MIDI || midi > GUITAR_SAMPLE_MAX_MIDI) return null;
  let best = GUITAR_SAMPLES[0];
  for (const sample of GUITAR_SAMPLES) {
    if (Math.abs(sample.rootMidi - midi) < Math.abs(best.rootMidi - midi)) best = sample;
  }
  return best;
}

export function guitarSamplePlaybackRate(midi: number, rootMidi: number): number {
  return 2 ** ((midi - rootMidi) / 12);
}
