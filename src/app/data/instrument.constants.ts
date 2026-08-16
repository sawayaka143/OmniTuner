import { Instrument } from '../models/instrument.model';

export const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: 'guitar',
    label: 'Guitar',
    stringCount: 6,
    tunings: [
      {
        id: 'standard',
        label: 'E STANDARD',
        strings: [
          { name: 'E2', freq: 82.41 },
          { name: 'A2', freq: 110.0 },
          { name: 'D3', freq: 146.83 },
          { name: 'G3', freq: 196.0 },
          { name: 'B3', freq: 246.94 },
          { name: 'E4', freq: 329.63 },
        ],
      },
      {
        id: 'dadgad',
        label: 'DADGAD',
        strings: [
          { name: 'D2', freq: 73.42 },
          { name: 'A2', freq: 110.0 },
          { name: 'D3', freq: 146.83 },
          { name: 'G3', freq: 196.0 },
          { name: 'A3', freq: 220.0 },
          { name: 'D4', freq: 293.66 },
        ],
      },
      {
        id: 'eb',
        label: 'E♭ STANDARD',
        strings: [
          { name: 'E♭2', freq: 77.78 },
          { name: 'A♭2', freq: 103.83 },
          { name: 'D♭3', freq: 138.59 },
          { name: 'G♭3', freq: 185.0 },
          { name: 'B♭3', freq: 233.08 },
          { name: 'E♭4', freq: 311.13 },
        ],
      },
      {
        id: 'facgce',
        label: 'FACGCE',
        strings: [
          { name: 'F2', freq: 87.31 },
          { name: 'A2', freq: 110.0 },
          { name: 'C3', freq: 130.81 },
          { name: 'G3', freq: 196.0 },
          { name: 'C4', freq: 261.63 },
          { name: 'E4', freq: 329.63 },
        ],
      },
    ],
  },
  {
    id: 'ukulele',
    label: 'Ukulele',
    stringCount: 4,
    tunings: [
      {
        id: 'standard',
        label: 'STANDARD',
        strings: [
          { name: 'G4', freq: 392.0 },
          { name: 'C4', freq: 261.63 },
          { name: 'E4', freq: 329.63 },
          { name: 'A4', freq: 440.0 },
        ],
      },
    ],
  },
];
