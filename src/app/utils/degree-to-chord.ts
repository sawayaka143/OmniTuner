import { pcName } from './chord-theory';

const ROMAN_OFFSET: Readonly<Record<string, number>> = {
  I: 0,
  II: 2,
  III: 4,
  IV: 5,
  V: 7,
  VI: 9,
  VII: 11,
};

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

interface ParsedDegree {
  readonly accidental: -1 | 0 | 1;
  readonly romanUpper: string;
  readonly isMinorCore: boolean;
  readonly suffix: string;
}

const DEGREE_RE = /^(b|#)?(VII|VI|IV|V|III|II|I)(.*)$/i;

function parseDegree(raw: string): ParsedDegree | null {
  const m = raw.trim().match(DEGREE_RE);
  if (!m) return null;
  const accidental: -1 | 0 | 1 = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  const core = m[2];
  const suffixRaw = (m[3] ?? '').trim();
  const romanUpper = core.toUpperCase();
  const isMinorCore = core !== romanUpper;
  const suffix = suffixRaw;
  return { accidental, romanUpper, isMinorCore, suffix };
}

export function degreeToChordSymbol(
  degree: string,
  tonicPc: number,
  useFlats: boolean,
): string | null {
  const parsed = parseDegree(degree);
  if (!parsed) return null;
  const offset = (ROMAN_OFFSET[parsed.romanUpper] ?? 0) + parsed.accidental;
  const rootPc = mod12(tonicPc + offset);
  const rootName = pcName(rootPc, useFlats);
  const suffixLower = parsed.suffix.toLowerCase();
  const suffixAlreadyHasQuality =
    suffixLower.startsWith('m') ||
    suffixLower.startsWith('dim') ||
    suffixLower.startsWith('°') ||
    suffixLower.startsWith('ø') ||
    suffixLower === '+' ||
    suffixLower === 'aug';
  let quality: string;
  if (parsed.suffix) {
    quality = parsed.isMinorCore && !suffixAlreadyHasQuality ? `m${parsed.suffix}` : parsed.suffix;
  } else {
    quality = parsed.isMinorCore ? 'm' : '';
  }
  return `${rootName}${quality}`;
}

export function tonicPcOf(noteName: string): number | null {
  const m = String(noteName)
    .trim()
    .match(/^([A-Ga-g])\s*([#b♯♭]?)/);
  if (!m) return null;
  const letters: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = letters[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  return mod12(pc);
}
