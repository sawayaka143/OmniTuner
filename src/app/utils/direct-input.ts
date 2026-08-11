/**
 * Direct fret input: parses a user-typed voicing (e.g. `x 3 2 0 1 0` or
 * `x32010`) into a full {@link VoicingShape} without the DFS search.
 */
import { ParsedChord, ParsedTuning, parseChord, CHORD_FORMULAS } from './chord-theory';
import { SoundingNote, VoicingShape } from './chord-voicing';
import { isPhysicallyPlayable } from './ergonomics';

export interface DirectParseOk {
  readonly ok: true;
  /** Per-string fret, index 0 = lowest string; null = muted. */
  readonly frets: readonly (number | null)[];
  /** Full shape built with the same logic as `makeShape` in chord-voicing.ts. */
  readonly shape: VoicingShape;
  /** Chord inferred from the shape's sounding notes (null if unrecognizable). */
  readonly inferredChord: ParsedChord | null;
}

export type DirectParseResult = DirectParseOk | { readonly ok: false; readonly error: string };

/** Allowed fret range. Mirrors the search window upper bound. */
export const DIRECT_MAX_FRET = 24;

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

const isCompact = (text: string): boolean => !/[,\s]/.test(text);

/**
 * Split the input into fret tokens: separated forms (`x 3 2 0 1 0`, `3,2,0`)
 * split on whitespace/commas; a compact form (`x32010`) is read digit by digit.
 */
export function tokenizeDirectInput(text: string): string[] {
  const trimmed = String(text).trim();
  if (!trimmed) return [];
  if (!isCompact(trimmed)) return trimmed.split(/[,\s]+/);
  return trimmed.split('');
}

const parseToken = (token: string): number | null | 'invalid' => {
  if (token === 'x' || token === 'X' || token === '-') return null;
  if (!/^\d+$/.test(token)) return 'invalid';
  const fret = Number(token);
  if (fret > DIRECT_MAX_FRET) return 'invalid';
  return fret;
};

/** Build a `VoicingShape` with the identical semantics as `makeShape`. */
export function makeDirectShape(
  frets: readonly (number | null)[],
  tuning: ParsedTuning,
  chord: ParsedChord,
): VoicingShape {
  const fretList = frets as (number | null)[];
  const sounding: SoundingNote[] = [];
  for (let i = 0; i < fretList.length; i++) {
    const fret = fretList[i];
    if (fret !== null) sounding.push({ stringIndex: i, fret, midi: tuning.midi[i] + fret });
  }
  const frettedOnly = fretList.filter((f): f is number => f !== null && f > 0);
  const span = frettedOnly.length ? Math.max(...frettedOnly) - Math.min(...frettedOnly) : 0;
  let bass = Infinity;
  for (const note of sounding) if (note.midi < bass) bass = note.midi;
  const bassIsRoot = mod12(bass - chord.rootPc) === 0;
  const position = frettedOnly.length ? Math.min(...frettedOnly) : 0;
  const openCount = fretList.filter((f) => f === 0).length;
  return { frets, sounding, span, bassMidi: bass, bassIsRoot, position, openCount, cost: 0 };
}

/**
 * Infer a chord symbol from the shape's sounding notes: the lowest note is
 * the root, and the stacked intervals above it are matched against the known
 * chord formulas. Null when the notes don't form a recognizable chord.
 */
export function inferChordFromShape(shape: VoicingShape): ParsedChord | null {
  const sorted = [...shape.sounding].sort((a, b) => a.midi - b.midi);
  if (!sorted.length) return null;
  const rootPc = mod12(sorted[0].midi);

  const intervals = [...new Set(sorted.map((n) => mod12(n.midi - rootPc)))].sort((a, b) => a - b);
  if (intervals.length < 2) return null; // A single tone isn't a chord.

  const candidate = Object.entries(CHORD_FORMULAS)
    .filter(
      ([, formula]) =>
        formula.intervals.length === intervals.length &&
        formula.intervals.every((interval, i) => interval === intervals[i]),
    )
    .sort((a, b) => a[0].length - b[0].length)[0];
  if (!candidate) return null;

  const [quality, formula] = candidate;
  const noteNames = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  ];
  const symbol = `${noteNames[rootPc]}${quality === 'maj' ? '' : quality}`;
  const parsed = parseChord(symbol);
  if (!parsed.ok) return null;
  return { ...parsed.chord, symbol, optionalPcs: formula.optional ?? [] };
}

/**
 * Parse a user-typed direct voicing into a shape. Returns `ok: false` with a
 * human message when the input is invalid (bad token, wrong string count, or
 * an all-muted shape).
 */
export function parseDirectInput(text: string, tuning: ParsedTuning): DirectParseResult {
  const tokens = tokenizeDirectInput(text);
  if (!tokens.length) return { ok: false, error: 'type a voicing first' };
  if (tokens.length !== tuning.midi.length) {
    return {
      ok: false,
      error: `expected ${tuning.midi.length} strings, got ${tokens.length}`,
    };
  }

  const frets: (number | null)[] = [];
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (parsed === 'invalid') return { ok: false, error: `"${token}" is not a fret (0-${DIRECT_MAX_FRET}) or mute (x/X/-)` };
    frets.push(parsed);
  }
  if (frets.every((f) => f === null)) {
    return { ok: false, error: 'shape is empty — all strings muted' };
  }

  const shape = makeDirectShape(frets, tuning, {
    symbol: '?',
    rootPc: 0,
    quality: '',
    intervals: [],
    pcs: [],
    optionalPcs: [],
    flats: tuning.flats,
  });
  const inferredChord = inferChordFromShape(shape);
  return { ok: true, frets, shape, inferredChord };
}

/** Ergonomics warning (not a hard block): null when playable, otherwise a hint. */
export function directPlayabilityWarning(
  shape: VoicingShape,
  options: { maxSpan?: number } = {},
): string | null {
  if (isPhysicallyPlayable(shape, undefined, { maxSpan: options.maxSpan ?? 4 })) return null;
  return `⚠ This shape spans ${shape.span} frets — are you sure?`;
}
