export const SHARP_PC_NAMES = [
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
] as const;
export const FLAT_PC_NAMES = [
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
] as const;

/** Interval degree labels relative to a chord root (index = pitch-class offset). */
export const DEGREE_LABELS: readonly string[] = [
  'R',
  'b2',
  '2',
  'b3',
  '3',
  '4',
  'b5',
  '5',
  '#5',
  '6',
  'b7',
  '7',
];

const PC_LETTER: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * A chord's interval formula. `intervals` are semitone offsets above the root
 * (9th = 14, 11th = 17, 13th = 21). `optional` tones (11ths/13ths of extended
 * chords) may be omitted from a voicing when there aren't enough strings —
 * guide tones (1, 3, 5, 7, 9) must always ring.
 */
export interface ChordFormula {
  readonly intervals: readonly number[];
  readonly optional?: readonly number[];
}

export const CHORD_FORMULAS: Readonly<Record<string, ChordFormula>> = {
  // Major family
  maj: { intervals: [0, 4, 7] },
  '6': { intervals: [0, 4, 7, 9] },
  '6/9': { intervals: [0, 4, 7, 9, 14] },
  maj7: { intervals: [0, 4, 7, 11] },
  maj9: { intervals: [0, 4, 7, 11, 14] },
  maj11: { intervals: [0, 4, 7, 11, 14, 17], optional: [17] },
  maj13: { intervals: [0, 4, 7, 11, 14, 17, 21], optional: [17, 21] },
  'maj7#11': { intervals: [0, 4, 7, 11, 18], optional: [18] },
  'maj13#11': { intervals: [0, 4, 7, 11, 14, 18, 21], optional: [18, 21] },
  'maj7#5': { intervals: [0, 4, 8, 11] },
  'maj9#5': { intervals: [0, 4, 8, 11, 14] },

  // Dominant family
  '7': { intervals: [0, 4, 7, 10] },
  '9': { intervals: [0, 4, 7, 10, 14] },
  '11': { intervals: [0, 4, 7, 10, 14, 17], optional: [17] },
  '13': { intervals: [0, 4, 7, 10, 14, 17, 21], optional: [17, 21] },
  '7b5': { intervals: [0, 4, 6, 10] },
  '7#5': { intervals: [0, 4, 8, 10] },
  '7b9': { intervals: [0, 4, 7, 10, 13] },
  '7#9': { intervals: [0, 4, 7, 10, 15] },
  '7#11': { intervals: [0, 4, 7, 10, 18], optional: [18] },
  '7b13': { intervals: [0, 4, 7, 10, 20], optional: [20] },
  '9#11': { intervals: [0, 4, 7, 10, 14, 18], optional: [18] },
  '13b9': { intervals: [0, 4, 7, 10, 13, 21], optional: [21] },
  '7#9b13': { intervals: [0, 4, 7, 10, 15, 20], optional: [20] },

  // Minor family
  min: { intervals: [0, 3, 7] },
  m6: { intervals: [0, 3, 7, 9] },
  'm6/9': { intervals: [0, 3, 7, 9, 14] },
  m7: { intervals: [0, 3, 7, 10] },
  m9: { intervals: [0, 3, 7, 10, 14] },
  m11: { intervals: [0, 3, 7, 10, 14, 17], optional: [17] },
  m13: { intervals: [0, 3, 7, 10, 14, 17, 21], optional: [17, 21] },
  mMaj7: { intervals: [0, 3, 7, 11] },
  mMaj9: { intervals: [0, 3, 7, 11, 14] },
  mMaj11: { intervals: [0, 3, 7, 11, 14, 17], optional: [17] },
  mMaj13: { intervals: [0, 3, 7, 11, 14, 17, 21], optional: [17, 21] },
  m7b5: { intervals: [0, 3, 6, 10] },

  // Diminished / augmented / suspended / add / power
  dim: { intervals: [0, 3, 6] },
  dim7: { intervals: [0, 3, 6, 9] },
  ø9: { intervals: [0, 3, 6, 10, 14] },
  aug: { intervals: [0, 4, 8] },
  '9#5': { intervals: [0, 4, 8, 10, 14] },
  sus2: { intervals: [0, 2, 7] },
  sus4: { intervals: [0, 5, 7] },
  '7sus2': { intervals: [0, 2, 7, 10] },
  '7sus4': { intervals: [0, 5, 7, 10] },
  maj7sus4: { intervals: [0, 5, 7, 11] },
  '9sus4': { intervals: [0, 5, 7, 10, 14] },
  '13sus4': { intervals: [0, 5, 7, 10, 14, 21], optional: [21] },
  '6sus4': { intervals: [0, 5, 7, 9] },
  add9: { intervals: [0, 4, 7, 14] },
  add11: { intervals: [0, 4, 7, 17] },
  madd9: { intervals: [0, 3, 7, 14] },
  madd11: { intervals: [0, 3, 7, 17] },
  '5': { intervals: [0, 7] },
};

const QUALITY_ALIASES: Readonly<Record<string, string>> = {
  '': 'maj',
  maj: 'maj',
  M: 'maj',
  major: 'maj',
  m: 'min',
  min: 'min',
  mi: 'min',
  '-': 'min',
  '7': '7',
  dom7: '7',
  maj7: 'maj7',
  M7: 'maj7',
  Δ7: 'maj7',
  delta7: 'maj7',
  m7: 'm7',
  mMaj7: 'mMaj7',
  'm(maj7)': 'mMaj7',
  dim: 'dim',
  '°': 'dim',
  o: 'dim',
  dim7: 'dim7',
  '°7': 'dim7',
  o7: 'dim7',
  m7b5: 'm7b5',
  ø: 'm7b5',
  ø7: 'm7b5',
  halfdim: 'm7b5',
  aug: 'aug',
  '+': 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  '6': '6',
  add6: '6',
  m6: 'm6',
  '9': '9',
  m9: 'm9',
  add9: 'add9',
  add2: 'add9',
  '5': '5',
  pow: '5',

  // Major family
  maj9: 'maj9',
  M9: 'maj9',
  Δ9: 'maj9',
  delta9: 'maj9',
  maj11: 'maj11',
  M11: 'maj11',
  Δ11: 'maj11',
  delta11: 'maj11',
  maj13: 'maj13',
  M13: 'maj13',
  Δ13: 'maj13',
  delta13: 'maj13',
  'maj7#11': 'maj7#11',
  'M7#11': 'maj7#11',
  'Δ7#11': 'maj7#11',
  'maj13#11': 'maj13#11',
  'M13#11': 'maj13#11',
  'Δ13#11': 'maj13#11',
  'maj7#5': 'maj7#5',
  'M7#5': 'maj7#5',
  'Δ7#5': 'maj7#5',
  'maj7+5': 'maj7#5',
  'maj9#5': 'maj9#5',
  'M9#5': 'maj9#5',
  'Δ9#5': 'maj9#5',
  '9+5': 'maj9#5',
  maj6: '6',
  '6/9': '6/9',
  '69': '6/9',
  '6add9': '6/9',
  'm6/9': 'm6/9',
  m69: 'm6/9',
  m6add9: 'm6/9',

  // Dominant family
  '11': '11',
  '13': '13',
  '7b5': '7b5',
  '7#5': '7#5',
  '+7': '7#5',
  aug7: '7#5',
  '7b9': '7b9',
  '7#9': '7#9',
  '7#11': '7#11',
  '7b13': '7b13',
  '9#11': '9#11',
  '13b9': '13b9',
  '7#9b13': '7#9b13',

  // Minor family
  m11: 'm11',
  m13: 'm13',
  mMaj9: 'mMaj9',
  mM9: 'mMaj9',
  'm(maj9)': 'mMaj9',
  mΔ9: 'mMaj9',
  'm(M9)': 'mMaj9',
  mMaj11: 'mMaj11',
  mM11: 'mMaj11',
  'm(maj11)': 'mMaj11',
  mΔ11: 'mMaj11',
  mMaj13: 'mMaj13',
  mM13: 'mMaj13',
  'm(maj13)': 'mMaj13',
  mΔ13: 'mMaj13',

  // Diminished / augmented / suspended / add
  ø9: 'ø9',
  halfdim9: 'ø9',
  '7sus2': '7sus2',
  '7sus': '7sus4',
  '7sus4': '7sus4',
  maj7sus4: 'maj7sus4',
  M7sus4: 'maj7sus4',
  Δ7sus4: 'maj7sus4',
  '9sus4': '9sus4',
  '9sus': '9sus4',
  '13sus4': '13sus4',
  '13sus': '13sus4',
  '6sus4': '6sus4',
  add11: 'add11',
  add4: 'add11',
  madd9: 'madd9',
  madd11: 'madd11',
  madd4: 'madd11',
  '+maj7': 'maj7#5',
  augmaj7: 'maj7#5',
  Δ: 'maj7',
};

export type ModeName =
  'Ionian' | 'Dorian' | 'Phrygian' | 'Lydian' | 'Mixolydian' | 'Aeolian' | 'Locrian';

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
  let pc = PC_LETTER[match[1].toUpperCase()];
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
  const tokens = String(raw)
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
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
  /** Pitch classes that a voicing may omit (11ths/13ths of extended chords). */
  readonly optionalPcs: readonly number[];
  readonly flats: boolean;
}

export type ChordParseResult =
  | { readonly ok: true; readonly chord: ParsedChord }
  | { readonly ok: false; readonly symbol: string; readonly error: string };

const normalizeQuality = (raw: string): string =>
  raw.replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase();

const ALTERATION_RE = /(?:b|#)?(?:5|9|11|13)|add(?:9|11)/g;

interface ComposedQuality {
  readonly key: string;
  readonly intervals: number[];
  readonly optional: number[];
}

/**
 * Compositional chord-quality parser: resolves symbols not in
 * `QUALITY_ALIASES` by matching the longest `CHORD_FORMULAS` key as a base,
 * then applying alteration/extension tokens (`7b5#9b13`, `m7b9`, …).
 * Returns null when the suffix can't be consumed.
 */
function composeQuality(raw: string): ComposedQuality | null {
  const normalized = normalizeQuality(raw);
  if (!normalized) return null;

  let baseKey: string | null = null;
  let prefixLength = 0;
  for (const key of Object.keys(CHORD_FORMULAS)) {
    if (normalized.startsWith(key) && (baseKey === null || key.length > baseKey.length)) {
      baseKey = key;
      prefixLength = key.length;
    }
  }
  if (baseKey === null && normalized.startsWith('m')) {
    // `m` is an alias for `min`, not a formula key — theoretical minor
    // alterations like `m♭9` (min + b9) still compose.
    baseKey = 'min';
    prefixLength = 1;
  }
  if (baseKey === null) return null;

  const base = CHORD_FORMULAS[baseKey];
  const remainder = normalized.slice(prefixLength);
  const intervals = [...base.intervals];
  const optional = [...(base.optional ?? [])];
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  let cursor = 0;
  ALTERATION_RE.lastIndex = 0;
  while ((match = ALTERATION_RE.exec(remainder)) !== null) {
    if (match.index !== cursor) return null; // unconsumed garbage between tokens
    tokens.push(match[0]);
    cursor = ALTERATION_RE.lastIndex;
  }
  if (cursor !== remainder.length) return null; // trailing garbage

  const drop = (value: number): void => {
    const i = intervals.indexOf(value);
    if (i >= 0) intervals.splice(i, 1);
  };
  const removeOptional = (value: number): void => {
    const i = optional.indexOf(value);
    if (i >= 0) optional.splice(i, 1);
  };
  const add = (value: number): void => {
    if (!intervals.includes(value)) intervals.push(value);
  };
  /** Add an extension tone that a voicing may omit (11th/13th color tones). */
  const addOptional = (value: number): void => {
    add(value);
    if (!optional.includes(value)) optional.push(value);
  };

  for (const token of tokens) {
    switch (token) {
      case 'b5':
        drop(7);
        add(6);
        removeOptional(6);
        break;
      case '#5':
        drop(7);
        add(8);
        removeOptional(8);
        break;
      case 'b9':
        drop(14);
        add(13);
        break;
      case '#9':
        drop(14);
        add(15);
        break;
      case '9':
        drop(13);
        drop(15);
        add(14);
        break;
      case '11':
        addOptional(17);
        break;
      case '#11':
        addOptional(18);
        break;
      case '13':
        addOptional(21);
        break;
      case 'b13':
        addOptional(20);
        break;
      case 'add9':
        add(14);
        break;
      case 'add11':
        addOptional(17);
        break;
      default:
        break;
    }
  }

  return {
    key: `${baseKey}${tokens.join('')}`,
    intervals: [...new Set(intervals)].sort((a, b) => a - b),
    optional: [...new Set(optional)].sort((a, b) => a - b),
  };
}

/** Parses a chord symbol like `Bb7`, `Cm`, `F#m7b5`. */
export function parseChord(raw: string): ChordParseResult {
  const symbol = String(raw).trim();
  const match = symbol.match(/^([A-Ga-g])\s*([#b♯♭]?)\s*(.*?)\s*$/);
  if (!match) return { ok: false, symbol, error: `'${symbol}' is not a chord symbol` };
  let rootPc = PC_LETTER[match[1].toUpperCase()];
  if (match[2] === '#' || match[2] === '♯') rootPc += 1;
  if (match[2] === 'b' || match[2] === '♭') rootPc -= 1;
  rootPc = mod12(rootPc);
  const qualityRaw = match[3];
  const hasAlias = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(QUALITY_ALIASES, key);
  let quality: string | undefined;
  if (hasAlias(qualityRaw)) quality = QUALITY_ALIASES[qualityRaw];
  else if (hasAlias(qualityRaw.toLowerCase())) quality = QUALITY_ALIASES[qualityRaw.toLowerCase()];
  let formula: ChordFormula | undefined;
  if (quality) formula = CHORD_FORMULAS[quality];
  if (!formula) {
    // Fall back to compositional parsing for arbitrary alteration combos
    // (e.g. `7b5#9b13`), whose key isn't a CHORD_FORMULAS entry.
    const composed = composeQuality(qualityRaw);
    if (composed) {
      quality = composed.key;
      formula = { intervals: composed.intervals, optional: composed.optional };
    }
  }
  if (!quality || !formula) {
    return {
      ok: false,
      symbol,
      error: `unknown chord quality '${qualityRaw || '(none)'}' in '${symbol}'`,
    };
  }
  const intervals = formula.intervals;
  const optionalIntervals = formula.optional ?? [];
  return {
    ok: true,
    chord: {
      symbol,
      rootPc,
      quality,
      intervals,
      pcs: intervals.map((interval) => mod12(rootPc + interval)),
      optionalPcs: optionalIntervals.map((interval) => mod12(rootPc + interval)),
      flats: match[2] === 'b' || match[2] === '♭',
    },
  };
}

/**
 * Splits a progression string into chord tokens.
 * Separators: `,` `;` `|` `/` (unless followed by a digit, so `C6/9` stays
 * one token), whitespace, and progression arrows/em-dashes (`->` `→` `—` `–`).
 * A `-` glued to a root (`C-`) is a minor-suffix, not a separator.
 */
export function tokenizeProgression(raw: string): string[] {
  const trimmed = String(raw).trim();
  const tokens = trimmed
    .split(/(?:->|→|—|–|,|;|\|)|\/(?![0-9])/)
    .map((t) => t.trim())
    .filter(Boolean);
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
  if (!parsed)
    return { kind: 'warn', text: `scale root '${scaleRoot}' unreadable — badge skipped` };

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
    '3,6': 'dim',
    '3,7': 'min',
    '4,7': 'maj',
    '4,8': 'aug',
  };
  const expectedQuality = EXPECTED[`${third},${fifth}`] ?? 'maj';

  let numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degreeIndex];
  if (expectedQuality === 'min' || expectedQuality === 'dim') numeral = numeral.toLowerCase();
  if (expectedQuality === 'dim') numeral += '°';
  if (expectedQuality === 'aug') numeral += '+';

  const QUALITY_WORD: Readonly<Record<string, string>> = {
    maj: 'major',
    min: 'minor',
    dim: 'diminished',
    aug: 'augmented',
  };
  const actualThird = chord.intervals.includes(4) ? 4 : chord.intervals.includes(3) ? 3 : null;
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
