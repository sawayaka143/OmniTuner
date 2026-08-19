import { Scale } from '../models/scale.model';

/**
 * Chromatic note names, **C-rooted** and indexable by absolute pitch class
 * (C = 0, ... B = 11). Two parallel spellings so enharmonic output can follow
 * the chosen root's accidental preference.
 */
export const SHARP_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export const FLAT_NAMES: readonly string[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * Scale / mode catalog. Each interval uses scale-degree notation relative to the
 * tonic, including Unicode accidentals where needed. To add a scale, append an
 * entry here — no other code changes required.
 */
export const SCALES: readonly Scale[] = [
  {
    id: 'major',
    label: 'Major',
    aka: 'Ionian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 4, label: '3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
      { semitones: 11, label: '7' },
    ],
  },
  {
    id: 'natural-minor',
    label: 'Minor',
    aka: 'Aeolian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 8, label: '♭6' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'harmonic-minor',
    label: 'Harmonic minor',
    group: 'Minor family',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 8, label: '♭6' },
      { semitones: 11, label: '7' },
    ],
  },
  {
    id: 'melodic-minor',
    label: 'Melodic minor',
    group: 'Minor family',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
      { semitones: 11, label: '7' },
    ],
  },
  {
    id: 'dorian',
    label: 'Dorian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'phrygian',
    label: 'Phrygian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 1, label: '♭2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 8, label: '♭6' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'lydian',
    label: 'Lydian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 4, label: '3' },
      { semitones: 6, label: '♯4' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
      { semitones: 11, label: '7' },
    ],
  },
  {
    id: 'mixolydian',
    label: 'Mixolydian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 4, label: '3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'locrian',
    label: 'Locrian',
    group: 'Church modes',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 1, label: '♭2' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 6, label: '♭5' },
      { semitones: 8, label: '♭6' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'major-pentatonic',
    label: 'Major pentatonic',
    aka: '5 notes',
    group: 'Pentatonic & blues',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 2, label: '2' },
      { semitones: 4, label: '3' },
      { semitones: 7, label: '5' },
      { semitones: 9, label: '6' },
    ],
  },
  {
    id: 'minor-pentatonic',
    label: 'Minor pentatonic',
    aka: '5 notes',
    group: 'Pentatonic & blues',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 7, label: '5' },
      { semitones: 10, label: '♭7' },
    ],
  },
  {
    id: 'blues',
    label: 'Blues',
    aka: '6 notes',
    group: 'Pentatonic & blues',
    intervals: [
      { semitones: 0, label: '1' },
      { semitones: 3, label: '♭3' },
      { semitones: 5, label: '4' },
      { semitones: 6, label: '♭5' },
      { semitones: 7, label: '5' },
      { semitones: 10, label: '♭7' },
    ],
  },
];
