import { degreeToChordSymbol } from './degree-to-chord';
import { tokenizeProgression } from './chord-theory';

export interface ProgressionMeta {
  readonly presetId: string | null;
  readonly degrees: readonly string[];
}

const DEGREE_VOCABULARY: readonly string[] = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'bII',
  'bIII',
  'bVI',
  'bVII',
  'bii',
  'biii',
  'bvi',
  'bvii',
  'I7',
  'II7',
  'III7',
  'IV7',
  'V7',
  'VI7',
  'VII7',
  'Imaj7',
  'iim7',
  'iiim7',
  'IVmaj7',
  'Vm7',
  'vim7',
  'viim7b5',
  'i7',
  'ii7',
  'iii7',
  'iv7',
  'v7',
  'vi7',
  'vii7',
  'im7',
  'iim7b5',
];

export function parseProgressionMeta(
  raw: string,
  tonicPc: number,
  useFlats: boolean,
): ProgressionMeta | null {
  const tokens = tokenizeProgression(raw);
  if (!tokens.length) return null;
  const degrees: string[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    const matches: string[] = [];
    for (const candidate of DEGREE_VOCABULARY) {
      if (degreeToChordSymbol(candidate, tonicPc, useFlats) === trimmed) {
        matches.push(candidate);
      }
    }
    if (matches.length !== 1) return null;
    degrees.push(matches[0]);
  }
  return { presetId: null, degrees };
}

export function flattenProgression(
  meta: ProgressionMeta,
  tonicPc: number,
  useFlats: boolean,
): string {
  return meta.degrees
    .map((degree) => degreeToChordSymbol(degree, tonicPc, useFlats))
    .filter((symbol): symbol is string => symbol !== null)
    .join(', ');
}
