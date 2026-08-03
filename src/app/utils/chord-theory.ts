/**
 * Chord theory primitives for the chord finder workbench:
 * note/tuning/chord parsing, chord formulas, church modes and the
 * diatonic-context badge. Pure functions only — no Angular imports —
 * so the voicing engine and specs can consume them directly.
 *
 * ASCII spellings (`#` / `b`) are used throughout, matching the
 * convention of `scale.constants.ts` (Unicode accidentals are display-only).
 */

export const SHARP_PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Interval degree labels relative to a chord root (index = pitch-class offset). */
export const DEGREE_LABELS: readonly string[] = [
  'R', 'b2', '2', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7',
];

const PC_LETTER: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const CHORD_FORMULAS: Readonly<Record<string, readonly number[]>> = {
  maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14], '5': [0, 7],
};

const QUALITY_ALIASES: Readonly<Record<string, string>> = {
  '': 'maj', maj: 'maj', M: 'maj', major: 'maj',
  m: 'min', min: 'min', mi: 'min', '-': 'min',
  '7': '7', dom7: '7',
  maj7: 'maj7', M7: 'maj7', Δ7: 'maj7', delta7: 'maj7',
  m7: 'm7', mMaj7: 'mMaj7', 'm(maj7)': 'mMaj7',
  dim: 'dim', '°': 'dim', o: 'dim',
  dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
  m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', halfdim: 'm7b5',
  aug: 'aug', '+': 'aug',
  sus2: 'sus2', sus4: 'sus4', sus: 'sus4',
  '6': '6', add6: '6', m6: 'm6',
  '9': '9', m9: 'm9', add9: 'add9', add2: 'add9',
  '5': '5', pow: '5',
};

export type ModeName =
  | 'Ionian' | 'Dorian' | 'Phrygian' | 'Lydian'
  | 'Mixolydian' | 'Aeolian' | 'Locrian';

export const MODES: Readonly<Record<ModeName, readonly number[]>> = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const MODE_NAMES = Object.keys(MODES) as ModeName[];

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

/** Pitch-class name for a given accidental preference. */
export function pcName(pc: number, flats: boolean): string {
  return (flats ? FLAT_PC_NAMES : SHARP_PC_NAMES)[mod12(pc)];
}

/** Full note name (pitch class + octave, MIDI convention: C4 = 60). */
export function midiName(midi: number, flats: boolean): string {
  return `${pcName(midi, flats)}${Math.floor(midi / 12) - 1}`;
}

export interface ParsedNote {
  readonly midi: number;
  readonly pc: number;
  readonly flats: boolean;
}

/** Parses a note token like `F#2` or `Bb3` into MIDI + pitch class. */
export function parseNoteToken(token: string): ParsedNote | null {
  const match = String(token).match(/^([A-Ga-g])\s*([#b♯♭]?)([-+]?\d+)$/);
  if (!match) return null;
  let pc = PC_LETTER[match[1].toUpperCase()] as number;
  if (match[2] === '#' || match[2] === '♯') pc += 1;
  if (match[2] === 'b' || match[2] === '♭') pc -= 1;
  const midi = (parseInt(match[3], 10) + 1) * 12 + pc;
  if (midi < 0 || midi > 127) return null;
  return { midi, pc: mod12(pc), flats: match[2] === 'b' || match[2] === '♭' };
}

export interface ParsedTuning {
  readonly midi: readonly number[];
  readonly labels: readonly string[];
  readonly flats: boolean;
}

export type TuningParseResult =
  | { readonly ok: true; readonly tuning: ParsedTuning }
  | { readonly ok: false; readonly error: string };

/** Parses a whitespace/comma-separated tuning, low string first. */
export function parseTuning(raw: string): TuningParseResult {
  const tokens = String(raw).split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: 'empty tuning' };
  if (tokens.length > 12) return { ok: false, error: 'max 12 strings' };
  const midi: number[] = [];
  const labels: string[] = [];
  let flats = false;
  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseNoteToken(tokens[i]);
    if (!parsed) return { ok: false, error: `bad note '${tokens[i]}'` };
    midi.push(parsed.midi);
    labels.push(midiName(parsed.midi, parsed.flats));
    if (i === 0) flats = parsed.flats;
  }
  return { ok: true, tuning: { midi, labels, flats } };
}

export interface ParsedChord {
  readonly symbol: string;
  readonly rootPc: number;
  readonly quality: string;
  readonly intervals: readonly number[];
  readonly pcs: readonly number[];
  readonly flats: boolean;
}

export type ChordParseResult =
  | { readonly ok: true; readonly chord: ParsedChord }
  | { readonly ok: false; readonly symbol: string; readonly error: string };

/** Parses a chord symbol like `Bb7`, `Cm`, `F#m7b5`. */
export function parseChord(raw: string): ChordParseResult {
  const symbol = String(raw).trim();
  const match = symbol.match(/^([A-Ga-g])\s*([#b♯♭]?)\s*(.*?)\s*$/);
  if (!match) return { ok: false, symbol, error: `'${symbol}' is not a chord symbol` };
  let rootPc = PC_LETTER[match[1].toUpperCase()] as number;
  if (match[2] === '#' || match[2] === '♯') rootPc += 1;
  if (match[2] === 'b' || match[2] === '♭') rootPc -= 1;
  rootPc = mod12(rootPc);
  const qualityRaw = match[3];
  const hasAlias = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(QUALITY_ALIASES, key);
  let quality: string | undefined;
  if (hasAlias(qualityRaw)) quality = QUALITY_ALIASES[qualityRaw];
  else if (hasAlias(qualityRaw.toLowerCase())) quality = QUALITY_ALIASES[qualityRaw.toLowerCase()];
  if (!quality) {
    return {
      ok: false,
      symbol,
      error: `unknown chord quality '${qualityRaw || '(none)'}' in '${symbol}'`,
    };
  }
  const intervals = CHORD_FORMULAS[quality];
  return {
    ok: true,
    chord: {
      symbol,
      rootPc,
      quality,
      intervals,
      pcs: intervals.map((interval) => mod12(rootPc + interval)),
      flats: match[2] === 'b' || match[2] === '♭',
    },
  };
}

/** Splits a progression string into chord tokens (`, ; | /` or spaces). */
export function tokenizeProgression(raw: string): string[] {
  const trimmed = String(raw).trim();
  const tokens = trimmed.split(/[,;|/]/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length <= 1 && /\s/.test(trimmed)) return trimmed.split(/\s+/).filter(Boolean);
  return tokens;
}

export interface DiatonicBadge {
  readonly kind: 'good' | 'warn' | 'bad';
  readonly text: string;
}

/**
 * Labels a chord's function relative to a key context (scale root + mode):
 * diatonic degree, borrowed quality or chromatic. Returns null when no
 * scale root is provided.
 */
export function computeBadge(
  chord: ParsedChord,
  scaleRootRaw: string,
  modeName: ModeName,
  tuningFlats: boolean,
): DiatonicBadge | null {
  const scaleRoot = (scaleRootRaw ?? '').trim();
  if (!scaleRoot) return null;
  const token = /\d/.test(scaleRoot) ? scaleRoot : `${scaleRoot}3`;
  const parsed = parseNoteToken(token);
  if (!parsed) return { kind: 'warn', text: `scale root '${scaleRoot}' unreadable — badge skipped` };

  const steps = MODES[modeName];
  let degreeIndex = -1;
  for (let i = 0; i < 7; i++) {
    if (mod12(parsed.pc + steps[i]) === chord.rootPc) {
      degreeIndex = i;
      break;
    }
  }
  const scaleRootName = pcName(parsed.pc, parsed.flats || tuningFlats);
  const rootName = pcName(chord.rootPc, chord.flats || tuningFlats);
  if (degreeIndex < 0) {
    return { kind: 'bad', text: `◈ chromatic — ${rootName} isn't in ${scaleRootName} ${modeName}` };
  }

  const third = mod12(steps[(degreeIndex + 2) % 7] - steps[degreeIndex]);
  const fifth = mod12(steps[(degreeIndex + 4) % 7] - steps[degreeIndex]);
  const EXPECTED: Readonly<Record<string, string>> = {
    '3,6': 'dim', '3,7': 'min', '4,7': 'maj', '4,8': 'aug',
  };
  const expectedQuality = EXPECTED[`${third},${fifth}`] ?? 'maj';

  let numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degreeIndex];
  if (expectedQuality === 'min' || expectedQuality === 'dim') numeral = numeral.toLowerCase();
  if (expectedQuality === 'dim') numeral += '°';
  if (expectedQuality === 'aug') numeral += '+';

  const QUALITY_WORD: Readonly<Record<string, string>> = {
    maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented',
  };
  const actualThird = chord.intervals.includes(4) ? 4 : (chord.intervals.includes(3) ? 3 : null);
  let actualFifth: number | null = null;
  for (const candidate of [7, 6, 8]) {
    if (chord.intervals.includes(candidate)) {
      actualFifth = candidate;
      break;
    }
  }
  const matches =
    (actualThird === null || actualThird === third) &&
    (actualFifth === null || actualFifth === fifth);
  if (matches) {
    return { kind: 'good', text: `◈ ${numeral} — diatonic to ${scaleRootName} ${modeName}` };
  }
  return {
    kind: 'warn',
    text: `◈ ${numeral} — borrowed: ${modeName} expects ${expectedQuality} (${QUALITY_WORD[expectedQuality]}) here`,
  };
}
