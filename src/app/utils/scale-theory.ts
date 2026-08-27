import { FretCell, IntervalEntry } from '../models/scale.model';
import { FLAT_NAMES, SHARP_NAMES } from '../data/scale.constants';
import { colorForLabel } from '../data/interval-colors';

const normalizeNote = (input: string): string => {
  const trimmed = input.trim().replace(/♭/g, 'b').replace(/♯/g, '#');
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
};

const SHARP_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  SHARP_NAMES.map((name, index) => [name, index]),
);
const FLAT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  FLAT_NAMES.map((name, index) => [name, index]),
);

export const parseNote = (input: string): number | null => {
  if (!input) return null;
  const normalized = normalizeNote(input);

  const withoutOctave = normalized.replace(/[0-9].*$/, '');

  if (withoutOctave in SHARP_INDEX) return SHARP_INDEX[withoutOctave];
  if (withoutOctave in FLAT_INDEX) return FLAT_INDEX[withoutOctave];
  return null;
};

export const noteName = (pitchClass: number, preferFlats: boolean): string => {
  const index = ((pitchClass % 12) + 12) % 12;
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[index];
};

export const intervalByPitchClass = (
  intervals: readonly IntervalEntry[],
): Map<number, IntervalEntry> => {
  const map = new Map<number, IntervalEntry>();
  for (const interval of intervals) {
    const pc = ((interval.semitones % 12) + 12) % 12;
    map.set(pc, interval);
  }
  return map;
};

export const computeFretboard = (
  openPitchClasses: readonly number[],
  fretCount: number,
  intervals: readonly IntervalEntry[],
  preferFlats: boolean,
  openMidiNotes?: readonly number[],
): FretCell[][] => {
  const intervalMap = intervalByPitchClass(intervals);

  const board: FretCell[][] = [];
  for (let stringIndex = 0; stringIndex < openPitchClasses.length; stringIndex++) {
    const openPc = ((openPitchClasses[stringIndex] % 12) + 12) % 12;
    const row: FretCell[] = [];
    for (let fret = 0; fret <= fretCount; fret++) {
      const pitchClass = (((openPc + fret) % 12) + 12) % 12;
      const interval = intervalMap.get(pitchClass) ?? null;
      row.push({
        stringIndex,
        fret,
        pitchClass,
        midi: openMidiNotes?.[stringIndex] !== undefined ? openMidiNotes[stringIndex] + fret : null,
        interval,
        noteName: noteName(pitchClass, preferFlats),
        color: interval ? colorForLabel(interval.label) : '',
        isRoot: interval?.label === 'R' || interval?.label === '1',
      });
    }
    board.push(row);
  }
  return board;
};
