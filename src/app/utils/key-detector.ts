import { flatsForPc, MODE_NAMES, ModeName, ParsedChord, pcName } from './chord-theory';
import { computeBadgeForPc } from './chord-theory';

export interface DetectedKey {
  readonly tonicPc: number;
  readonly tonicName: string;
  readonly mode: ModeName;
  readonly score: number;
  readonly coverage: number;
  readonly confidence: 'strong' | 'moderate' | 'weak';
  readonly alternatives: readonly DetectedKey[];
}

const MODE_PRIORITY: Readonly<Record<ModeName, number>> = {
  Ionian: 0,
  Aeolian: 1,
  Dorian: 2,
  Mixolydian: 3,
  Lydian: 4,
  Phrygian: 5,
  Locrian: 6,
};

function confidenceFor(coverage: number): DetectedKey['confidence'] {
  if (coverage >= 0.85) return 'strong';
  if (coverage >= 0.6) return 'moderate';
  return 'weak';
}

export function rankKeys(
  chords: readonly ParsedChord[],
  opts?: { readonly tuningFlats?: boolean },
): DetectedKey[] {
  if (!chords.length) return [];
  const hasFlatChord = chords.some((c) => c.flats);
  const candidates: DetectedKey[] = [];

  for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
    const flatsForTonic = flatsForPc(tonicPc);
    const useFlats = hasFlatChord ? true : (opts?.tuningFlats ?? flatsForTonic);
    const tonicName = pcName(tonicPc, useFlats || !!opts?.tuningFlats);
    for (const mode of MODE_NAMES) {
      let score = 0;
      let good = 0;
      for (const chord of chords) {
        const badge = computeBadgeForPc(chord, tonicPc, mode, !!opts?.tuningFlats, useFlats);
        if (!badge) continue;
        if (badge.kind === 'good') {
          score += 2;
          good++;
        } else if (badge.kind === 'warn') {
          score += 1;
        }
      }
      const coverage = chords.length ? good / chords.length : 0;
      candidates.push({
        tonicPc,
        tonicName,
        mode,
        score,
        coverage,
        confidence: confidenceFor(coverage),
        alternatives: [],
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    const pa = MODE_PRIORITY[a.mode] ?? 99;
    const pb = MODE_PRIORITY[b.mode] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.tonicPc - b.tonicPc;
  });

  return candidates;
}

export function detectKey(
  chords: readonly ParsedChord[],
  opts?: { readonly tuningFlats?: boolean },
): DetectedKey | null {
  const ranked = rankKeys(chords, opts);
  if (!ranked.length) return null;
  const top = ranked[0];
  if (top.score === 0) return { ...top, confidence: 'weak', alternatives: ranked.slice(1, 3) };
  const alts = ranked.slice(1, 3);
  return { ...top, alternatives: alts };
}
