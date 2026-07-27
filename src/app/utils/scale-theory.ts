import { FretCell, IntervalEntry } from '../models/scale.model';
import { FLAT_NAMES, SHARP_NAMES } from '../data/scale.constants';
import { colorForLabel } from '../data/interval-colors';

/**
 * Normalize a user-typed note so it can be matched against the chromatic arrays.
 * Only the letter is uppercased — the flat suffix 'b' must stay lowercase to
 * match `FLAT_NAMES` (e.g. 'db' -> 'Db', not 'DB').
 */
const normalizeNote = (input: string): string =>
  input
    .trim()
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/^([a-gA-G])/, (_, letter: string) => letter.toUpperCase());

// Build the flat/sharp lookup tables once.
const SHARP_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  SHARP_NAMES.map((name, index) => [name, index]),
);
const FLAT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  FLAT_NAMES.map((name, index) => [name, index]),
);

/**
 * Parse a user-supplied note name to an absolute pitch class (0–11, C = 0).
 *
 * Accepts both spellings ('D#' and 'Eb'), Unicode accidentals ('♭'/'♯'), and any
 * case. Octave digits are ignored — the Scales feature is pitch-class based.
 * Returns `null` for anything that is not a valid chromatic note, **never
 * throws**, so invalid custom-tuning input cannot break the UI.
 */
export const parseNote = (input: string): number | null => {
  if (!input) return null;
  const normalized = normalizeNote(input);

  // Strip any trailing octave (e.g. 'E2' -> 'E') for matching.
  const withoutOctave = normalized.replace(/[0-9].*$/, '');

  if (withoutOctave in SHARP_INDEX) return SHARP_INDEX[withoutOctave];
  if (withoutOctave in FLAT_INDEX) return FLAT_INDEX[withoutOctave];
  return null;
};

/**
 * Resolve a display name for a pitch class, honoring the chosen accidental
 * preference so enharmonic spelling follows the root (e.g. Eb roots show flats).
 */
export const noteName = (pitchClass: number, preferFlats: boolean): string => {
  const index = ((pitchClass % 12) + 12) % 12;
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[index];
};

/**
 * Decide whether notes under this root should be spelled with flats. A root
 * spelled with a flat (Db, Eb, Gb, Ab, Bb) uses flat spelling for the whole
 * scale; everything else (naturals and sharps like F#) uses sharps. The check is
 * on the *spelling* of the input, not just its pitch class, so 'F#' and 'Gb'
 * resolve differently despite being enharmonic.
 */
export const preferFlatsFor = (rootName: string): boolean => {
  const normalized = normalizeNote(rootName);
  return normalized.endsWith('b');
};

/**
 * Map each pitch class to the interval that produces it. When two intervals land
 * on the same pitch class (e.g. a b5 and a #11 are enharmonic), the **later**
 * interval in the array wins — callers control precedence by ordering.
 */
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

/**
 * Parse a list of custom-tuning note inputs (one per string) into pitch classes.
 * Each input maps independently to a `number` (valid) or `null` (invalid/empty),
 * so a single bad value never invalidates the whole tuning.
 */
export const tuningToPitchClasses = (
  noteInputs: readonly string[],
): (number | null)[] => noteInputs.map((input) => parseNote(input));

/**
 * The core, UI-agnostic fretboard engine.
 *
 * Given the open-string pitch classes (already oriented **high-string-first**,
 * so index 0 is the top row), a fret count, and a generic list of intervals, it
 * returns a `strings × (fretCount + 1)` matrix of fully-resolved, display-ready
 * cells. Every cell knows whether it is in the scale (and if so, its interval,
 * color and note name) — the template only renders.
 *
 * This intentionally takes a plain `IntervalEntry[]` rather than a `Scale`, so
 * the **same engine** can later drive a Chord Builder with a different set of
 * intervals and no logic changes.
 */
export const computeFretboard = (
  openPitchClasses: readonly number[],
  fretCount: number,
  intervals: readonly IntervalEntry[],
  preferFlats: boolean,
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
        interval,
        noteName: noteName(pitchClass, preferFlats),
        color: interval ? colorForLabel(interval.label) : '',
        isRoot: interval?.label === 'R',
      });
    }
    board.push(row);
  }
  return board;
};
