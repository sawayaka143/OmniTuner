/**
 * Ergonomics model for the chord-finder: deterministic playability scoring.
 * Pure functions only — no Angular imports — so vitest specs consume the same
 * code. Converts a fingering into physical features (barres, stretches, open
 * strings, doublings, bass thickness) and combines them with an exported
 * weight set.
 */

import { ParsedChord, ParsedTuning } from './chord-theory';
import { VoicingShape } from './chord-voicing';

/** Fret gap above which we suspect thumb fretting. */
const THUMB_FRETTING_DELTA = 2;

/**
 * Width of a fret at a given position, relative to the first fret — frets
 * narrow up the neck, so stretches get easier higher up.
 */
export function fretWidthFactor(position: number): number {
  return 1 / (1 + position * 0.05);
}

/** Hard physical constraints for a voicing shape. */
export interface PlayabilityOptions {
  /** Max fret span (max fretted − min fretted) allowed. 0 = no limit. */
  readonly maxSpan?: number;
  /**
   * When true, reject shapes whose fretted strings can only be covered by
   * impossible barres — e.g. frets on strings 1 and 6 with strings 2–5 at
   * different frets (a barre cannot jump over strings).
   */
  readonly rejectUnbarrable?: boolean;
}

/**
 * The Bouncer: rejects physically impossible voicings before scoring.
 * Open strings and mutes take no fingers.
 */
export function isPhysicallyPlayable(
  shape: VoicingShape,
  _tuning?: ParsedTuning,
  options: PlayabilityOptions = {},
): boolean {
  const maxSpan = options.maxSpan ?? 4;
  const rejectUnbarrable = options.rejectUnbarrable ?? false;

  const fretted = shape.frets.filter((f): f is number => f !== null && f > 0);
  if (!fretted.length) return true;

  const minFret = Math.min(...fretted);
  const maxFret = Math.max(...fretted);
  if (maxSpan > 0 && maxFret - minFret > maxSpan) return false;

  // Consecutive strings sharing a fret are one finger (barre); everything
  // else needs its own. Five independent fingers are impossible.
  let fingersNeeded = 0;
  let s = 0;
  while (s < shape.frets.length) {
    const fret = shape.frets[s];
    if (fret === null || fret === 0) {
      s++;
      continue;
    }
    let runEnd = s + 1;
    while (runEnd < shape.frets.length && shape.frets[runEnd] === fret) runEnd++;
    fingersNeeded++;
    s = runEnd;
  }
  if (fingersNeeded > 4) return false;

  // Strict barre logic (opt-in): a barre covers a contiguous run of strings at
  // one fret. If two strings share a fret and a string between them sounds a
  // different fret (or is open/muted, breaking the barre), no single barre can
  // cover both — reject when the caller opts in (some players can execute
  // partial barres).
  if (rejectUnbarrable) {
    const frettedIndexes = shape.frets
      .map((fret, index) => (fret !== null && fret > 0 ? index : -1))
      .filter((index) => index >= 0);
    for (let i = 0; i < frettedIndexes.length; i++) {
      const a = frettedIndexes[i];
      for (let j = i + 1; j < frettedIndexes.length; j++) {
        const b = frettedIndexes[j];
        if (shape.frets[a] === shape.frets[b] && b - a > 1) {
          // Between a and b there is at least one string; if that string is
          // open/muted or fretted at a different fret, the barre is impossible.
          for (let m = a + 1; m < b; m++) {
            if (shape.frets[m] === null || shape.frets[m] !== shape.frets[a]) return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Convenience filter applying {@link isPhysicallyPlayable} to a list of
 * shapes — useful at the search boundary or in tests.
 */
export function filterPlayable(
  shapes: readonly VoicingShape[],
  tuning?: ParsedTuning,
  options?: PlayabilityOptions,
): VoicingShape[] {
  return shapes.filter((shape) => isPhysicallyPlayable(shape, tuning, options));
}

/** A fret occupied by the same finger across consecutive strings (a barre). */
export interface Barre {
  readonly fret: number;
  /** Number of strings covered by the barre (2+). */
  readonly width: number;
  /** Lowest string index covered (0 = lowest string). */
  readonly startString: number;
}

/**
 * Which fret each sounding string is likely fretted with, guitar-style:
 * index finger = lowest fretted fret, other fingers take the rest by fret order.
 * Null = muted (no finger). Open strings are not assigned a finger.
 */
export interface FingerShape {
  /** Per-string finger (1-4) or null for muted/open. Index 0 = lowest string. */
  readonly fingers: readonly (number | null)[];
  /** Barres detected across consecutive strings sharing a fret. */
  readonly barres: readonly Barre[];
  /** Fret range of the index finger (excluding barres across gaps). */
  readonly indexSpan: number;
  /** Fret range of fingers 2-4 (the "stretch" fingers). */
  readonly stretchSpan: number;
  /** Lowest fretted fret in the shape. */
  readonly position: number;
}

/** Which playability factors are being penalized/bonused (for UI hints). */
export type ErgonomicsFactor =
  | 'barre'
  | 'stretch'
  | 'position'
  | 'bass'
  | 'open'
  | 'doubling'
  | 'thumb';

/** Feature vector consumed by the ergonomics cost model. //*/
export interface ErgonomicsFeatures {
  readonly position: number;
  readonly span: number;
  readonly indexSpan: number;
  readonly stretchSpan: number;
  readonly barreCount: number;
  readonly maxBarreWidth: number;
  readonly barreAtHighFret: boolean;
  readonly openCount: number;
  readonly bassString: number;
  readonly bassIsRoot: boolean;
  readonly rootDoubled: boolean;
  readonly thirdDoubled: boolean;
  readonly fifthDoubled: boolean;
  readonly noteCount: number;
  readonly fingeredCount: number;
  /** Fret span of the widest stretch between adjacent fretted strings. */
  readonly maxSpan: number;
  /** True when a muted string sits between two sounding strings. */
  readonly hasStringSkip: boolean;
  /** True when the lowest string is fretted but higher strings sit 2+ frets above it. */
  readonly hasThumbFret: boolean;
}

export interface ErgonomicsScore {
  /** Lower is better. */
  readonly cost: number;
  readonly features: ErgonomicsFeatures;
  /** Factors that meaningfully contributed (for UI hints). */
  readonly factors: readonly ErgonomicsFactor[];
}

/**
 * Weights for the ergonomics cost model. The shipped defaults are never
 * mutated at runtime.
 */
export const ERGONOMICS_WEIGHTS = {
  positionPerFret: 0.3,
  spanPerFret: 0.5,
  indexSpanPerFret: 0.7,
  stretchPerFret: 0.9,
  barrePerBarre: 1.2,
  barreWidthPerString: 0.5,
  barreHighFret: 2.0,
  openPerString: -0.6,
  doublingPerTone: 0.5,
  rootDoubleBonus: -0.75,
  bassNotRoot: 1.5,
  bassStringPerString: 0.25,
  stringSkip: 2.5,
  thumbFretting: 4.0,
  stretchExponent: 2,
  fretWidthRate: 0.05,
  /** Per extra ringing note above the chord-tone minimum (reward for fuller voicings). */
  noteCountPerNote: -0.35,
} as const;

export type ErgonomicsWeights = typeof ERGONOMICS_WEIGHTS;

/** Shipped default weights. */
export const BASE_ERGONOMICS_WEIGHTS: ErgonomicsWeights = ERGONOMICS_WEIGHTS;

/** Feature names that map to ergonomics factors (for UI hints). */
const FACTOR_BY_FEATURE: readonly {
  feature: keyof ErgonomicsFeatures;
  factor: ErgonomicsFactor;
}[] = [
  { feature: 'barreCount', factor: 'barre' },
  { feature: 'maxBarreWidth', factor: 'barre' },
  { feature: 'stretchSpan', factor: 'stretch' },
  { feature: 'indexSpan', factor: 'stretch' },
  { feature: 'span', factor: 'stretch' },
  { feature: 'position', factor: 'position' },
  { feature: 'bassString', factor: 'bass' },
  { feature: 'openCount', factor: 'open' },
  { feature: 'rootDoubled', factor: 'doubling' },
  { feature: 'hasStringSkip', factor: 'thumb' },
  { feature: 'hasThumbFret', factor: 'thumb' },
];

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

/**
 * Estimate the finger shape of a voicing: the index finger takes the lowest
 * fretted fret; strings sharing a fret under one finger form a barre.
 * Deterministic and testable, though real fingering varies.
 */
export function detectFingers(frets: readonly (number | null)[]): FingerShape {
  const n = frets.length;
  const fretted: { string: number; fret: number }[] = [];
  for (let s = 0; s < n; s++) {
    const fret = frets[s];
    if (fret !== null && fret > 0) fretted.push({ string: s, fret });
  }
  const position = fretted.length ? Math.min(...fretted.map((f) => f.fret)) : 0;

  // Fingers 2-4 assigned by fret order to non-lowest fretted strings.
  const fingers: (number | null)[] = new Array(n).fill(null);
  const ordered = [...fretted].sort((a, b) => a.fret - b.fret || a.string - b.string);
  let nextFinger = 2;
  for (const { string, fret } of ordered) {
    if (fret === position) fingers[string] = 1;
    else fingers[string] = Math.min(nextFinger++, 4);
  }

  // Consecutive strings under finger 1 at the same fret form a barre.
  const barres: Barre[] = [];
  for (let s = 0; s < n; s++) {
    if (fingers[s] !== 1) continue;
    const fret = frets[s];
    if (fret === null || fret === 0) continue;
    let w = 1;
    while (s + w < n && fingers[s + w] === 1 && frets[s + w] === fret) w++;
    if (w >= 2) barres.push({ fret, width: w, startString: s });
    s += w - 1;
  }

  const indexFrets = new Set<number>();
  for (const { string, fret } of fretted) if (fingers[string] === 1) indexFrets.add(fret);
  const indexSpan = indexFrets.size ? Math.max(...indexFrets) - Math.min(...indexFrets) : 0;

  const stretchFrets = new Set<number>();
  for (const { string, fret } of fretted) if (fingers[string] !== 1) stretchFrets.add(fret);
  const stretchSpan = stretchFrets.size ? Math.max(...stretchFrets) - Math.min(...stretchFrets) : 0;

  return { fingers, barres, indexSpan, stretchSpan, position };
}

/**
 * Build the feature vector for a voicing — the exact features the cost model
 * scores. Keep it stable.
 */
export function ergonomicsFeatures(
  shape: VoicingShape,
  tuning: ParsedTuning,
  chord: ParsedChord,
): ErgonomicsFeatures {
  const frets = shape.frets;
  const n = tuning.midi.length;
  const finger = detectFingers(frets);

  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const position = fretted.length ? Math.min(...fretted) : 0;
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;

  const openCount = frets.filter((f) => f === 0).length;
  const barreCount = finger.barres.length;
  const maxBarreWidth = finger.barres.reduce((max, b) => Math.max(max, b.width), 0);
  const barreAtHighFret = finger.barres.some((b) => b.fret >= 7);

  // Barre runs count as one finger each.
  const fingeredCount = new Set(finger.fingers.filter((f): f is number => f !== null)).size;

  // Widest gap between adjacent fretted strings (the "real" stretch).
  let maxSpan = 0;
  const frettedIndexes = frets
    .map((fret, index) => (fret !== null && fret > 0 ? index : -1))
    .filter((index) => index >= 0);
  for (let i = 1; i < frettedIndexes.length; i++) {
    const a = frettedIndexes[i - 1];
    const b = frettedIndexes[i];
    maxSpan = Math.max(maxSpan, (frets[b] ?? 0) - (frets[a] ?? 0));
  }

  // Muted string between two sounding strings needs awkward muting.
  const hasStringSkip = frets.some(
    (fret, index) =>
      fret === null &&
      index > 0 &&
      index < n - 1 &&
      frets[index - 1] !== null &&
      frets[index + 1] !== null,
  );

  // Lowest string fretted with higher strings 2+ frets above implies thumb fretting.
  let hasThumbFret = false;
  if (frets[0] !== null && frets[0] > 0) {
    for (const fret of frets.slice(1)) {
      if (fret !== null && fret > 0 && fret - (frets[0] ?? 0) >= THUMB_FRETTING_DELTA) {
        hasThumbFret = true;
        break;
      }
    }
  }

  let bassMidi = Infinity;
  let bassString = 0;
  for (const note of shape.sounding) {
    if (note.midi < bassMidi) {
      bassMidi = note.midi;
      bassString = note.stringIndex;
    }
  }
  const bassIsRoot = mod12(bassMidi - chord.rootPc) === 0;

  const pcCounts = new Map<number, number>();
  for (const note of shape.sounding) {
    const pc = mod12(note.midi);
    pcCounts.set(pc, (pcCounts.get(pc) ?? 0) + 1);
  }
  const rootDoubled = (pcCounts.get(chord.rootPc) ?? 0) > 1;
  const thirdInterval = chord.intervals[1] ?? 4;
  const fifthInterval = chord.intervals[2] ?? 7;
  const thirdDoubled = (pcCounts.get(mod12(chord.rootPc + thirdInterval)) ?? 0) > 1;
  const fifthDoubled = (pcCounts.get(mod12(chord.rootPc + fifthInterval)) ?? 0) > 1;

  return {
    position,
    span,
    indexSpan: finger.indexSpan,
    stretchSpan: finger.stretchSpan,
    barreCount,
    maxBarreWidth,
    barreAtHighFret,
    openCount,
    bassString,
    bassIsRoot,
    rootDoubled,
    thirdDoubled,
    fifthDoubled,
    noteCount: shape.sounding.length,
    fingeredCount,
    maxSpan,
    hasStringSkip,
    hasThumbFret,
  };
}

/**
 * Total ergonomics cost of a voicing. Lower is better. Non-linear combination
 * of features: stretch/span terms are squared and scaled by fret width at the
 * position; string-skips and thumb-fretting get flat penalties.
 */
export function scoreErgonomics(
  shape: VoicingShape,
  tuning: ParsedTuning,
  chord: ParsedChord,
  allowOpens = true,
  weights: ErgonomicsWeights = ERGONOMICS_WEIGHTS,
  jitter = 0,
): ErgonomicsScore {
  const f = ergonomicsFeatures(shape, tuning, chord);
  const w = weights;
  const widthFactor = fretWidthFactor(f.position);
  const exp = w.stretchExponent;

  let cost = 0;
  cost += f.position * w.positionPerFret;
  cost += Math.pow(f.span, exp) * w.spanPerFret * widthFactor;
  cost += Math.pow(f.indexSpan, exp) * w.indexSpanPerFret * widthFactor;
  cost += Math.pow(f.stretchSpan, exp) * w.stretchPerFret * widthFactor;
  cost += f.barreCount * w.barrePerBarre;
  cost += Math.max(0, f.maxBarreWidth - 2) * w.barreWidthPerString;
  if (f.barreAtHighFret) cost += w.barreHighFret;
  if (allowOpens) cost += Math.min(f.openCount, 2) * w.openPerString;
  const doublingCount =
    (f.rootDoubled ? 1 : 0) + (f.thirdDoubled ? 1 : 0) + (f.fifthDoubled ? 1 : 0);
  cost += Math.min(doublingCount, 1) * w.doublingPerTone;
  if (f.rootDoubled) cost += w.rootDoubleBonus;
  // Ringing more chord tones is a feature, not noise: reward each sounding
  // note beyond the first (so sparse truncated shapes don't tie full ones).
  cost += (f.noteCount - 1) * w.noteCountPerNote;
  if (!f.bassIsRoot) cost += w.bassNotRoot;
  cost += f.bassString * w.bassStringPerString;
  if (f.hasStringSkip) cost += w.stringSkip;
  if (f.hasThumbFret) cost += w.thumbFretting;
  if (jitter > 0) cost += Math.random() * jitter;

  const factors: ErgonomicsFactor[] = [];
  for (const { feature, factor } of FACTOR_BY_FEATURE) {
    if (factor === 'doubling' && !f.rootDoubled) continue;
    if (f[feature]) factors.push(factor);
  }
  if (f.barreAtHighFret) factors.push('barre');
  if (f.stretchSpan > 0) factors.push('stretch');
  if (f.indexSpan > 0) factors.push('stretch');
  if (f.hasStringSkip) factors.push('thumb');
  if (f.hasThumbFret) factors.push('thumb');

  return { cost, features: f, factors: [...new Set(factors)] };
}

/** Short human explanations for each ergonomics factor (UI hints). */
export const WHY_HINTS: Readonly<Record<ErgonomicsFactor, string>> = {
  barre: 'barre',
  stretch: 'stretch',
  position: 'high position',
  bass: 'root not in bass',
  open: 'open strings',
  doubling: 'doubled root',
  thumb: 'thumb fretting / skipped string',
};

/**
 * Viterbi-style pathfinding over a chord progression: the globally lowest-cost
 * path of voicings, where moving between adjacent voicings costs
 * `transitionCost`. O(chords × shapesPerChord²).
 *
 * @returns `cost` total path cost, `choices` per-chord ergonomics cost,
 * `path` voicing index per chord.
 */
export function scoreProgressionVoicings(
  chords: readonly ParsedChord[],
  tuning: ParsedTuning,
  shapesPerChord: readonly (readonly VoicingShape[])[],
  weights: ErgonomicsWeights = BASE_ERGONOMICS_WEIGHTS,
  jitter = 0,
): { cost: number; choices: readonly number[]; path: readonly number[] } {
  const count = Math.min(chords.length, shapesPerChord.length);
  if (count === 0) return { cost: 0, choices: [], path: [] };

  // dp[i][j] = lowest total cost ending at chord i with voicing j.
  const dp: number[][] = [];
  const back: number[][] = [];
  const choices: number[] = [];

  const first = shapesPerChord[0];
  if (first.length === 0) {
    dp.push([Infinity]);
    back.push([-1]);
  } else {
    dp.push(first.map((shape) => scoreErgonomics(shape, tuning, chords[0], true, weights, jitter).cost));
    back.push(new Array(first.length).fill(-1));
    choices.push(dp[0].length ? Math.min(...dp[0]) : Infinity);
  }

  for (let i = 1; i < count; i++) {
    const prev = shapesPerChord[i - 1];
    const current = shapesPerChord[i];
    const row: number[] = [];
    const backRow: number[] = [];

    if (current.length === 0) {
      dp.push([Infinity]);
      back.push([-1]);
      choices.push(Infinity);
      continue;
    }

    for (let j = 0; j < current.length; j++) {
      const ergo = scoreErgonomics(current[j], tuning, chords[i], true, weights, jitter).cost;
      let best = Infinity;
      let bestK = -1;
      const prevDp = dp[i - 1];
      for (let k = 0; k < prev.length; k++) {
        const candidate = prevDp[k] + transitionCost(prev[k], current[j]);
        if (candidate < best) {
          best = candidate;
          bestK = k;
        }
      }
      row.push(best + ergo);
      backRow.push(bestK);
    }
    dp.push(row);
    back.push(backRow);
    choices.push(row.length ? Math.min(...row) : Infinity);
  }

  // Reconstruct the optimal path from the backpointers.
  const lastRow = dp[count - 1];
  let bestJ = 0;
  for (let j = 1; j < lastRow.length; j++) if (lastRow[j] < lastRow[bestJ]) bestJ = j;
  const path: number[] = new Array(count).fill(0);
  let currentJ = bestJ;
  for (let i = count - 1; i >= 0; i--) {
    path[i] = currentJ;
    if (i > 0) currentJ = back[i][currentJ];
  }

  return { cost: lastRow[bestJ], choices, path };
}

/** Cost of moving between two voicings: per-string fret deltas + position delta. */
export function transitionCost(a: VoicingShape, b: VoicingShape): number {
  const n = Math.max(a.frets.length, b.frets.length);
  let cost = 0;
  for (let s = 0; s < n; s++) {
    const fa = a.frets[s] ?? 0;
    const fb = b.frets[s] ?? 0;
    cost += Math.abs(fa - fb);
  }
  const pa = a.frets.filter((f): f is number => f !== null && f > 0);
  const pb = b.frets.filter((f): f is number => f !== null && f > 0);
  const posA = pa.length ? Math.min(...pa) : 0;
  const posB = pb.length ? Math.min(...pb) : 0;
  cost += Math.abs(posA - posB) * 2;
  return cost;
}
