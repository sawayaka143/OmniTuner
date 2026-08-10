/**
 * Ergonomics model for the chord-finder: deterministic, transparent playability
 * scoring for a single voicing shape. Pure functions only — no Angular imports —
 * so vitest specs and (later) a learned re-ranker can consume the same features.
 *
 * The model converts a fingering into the physical features a guitarist actually
 * feels — barres, finger stretches, open strings, doublings, bass thickness —
 * then combines them with a small, exported weight set. These weights are the
 * single place to tune "what makes a voicing easy"; they also double as the
 * future input vector for a hybrid ML re-ranker.
 *
 * The cost model is deliberately non-linear:
 *  - stretches are penalized quadratically (`stretchSpan²`), because a 4-fret
 *    stretch is not twice as hard as a 2-fret stretch — it is roughly four
 *    times as hard;
 *  - every penalty is scaled by a fret-width factor that shrinks as the hand
 *    moves up the neck, where frets get physically closer together
 *    (`1 / (1 + position · 0.05)`);
 *  - structural impossibilities (span > 4, five independent fingers, an
 *    unbarrable string layout) are rejected outright by `isPhysicallyPlayable`
 *    before any scoring happens.
 */

import { ParsedChord, ParsedTuning } from './chord-theory';
import { VoicingShape } from './chord-voicing';

/** How many frets apart two notes must be before we suspect thumb fretting. */
const THUMB_FRETTING_DELTA = 2;

/**
 * Width of a fret at a given left-hand position, relative to the first fret.
 * Frets narrow as you move up the neck (equal temperament), so a stretch at
 * the 9th fret is physically easier than the same stretch at the 1st fret.
 * This factor (≈1.0 at position 1, ≈0.69 at position 9) scales stretch
 * penalties down as the position rises.
 */
export function fretWidthFactor(position: number): number {
  return 1 / (1 + position * 0.05);
}

/** Hard physical constraints for a voicing shape. */
export interface PlayabilityOptions {
  /** Maximum fret span (max fretted fret − min fretted fret) allowed. 0 = no limit. */
  readonly maxSpan?: number;
  /**
   * When true, reject shapes whose fretted strings can only be covered by
   * impossible barres — e.g. frets on strings 1 and 6 at the same fret with
   * strings 2–5 sounding different frets (a barre cannot jump over strings).
   */
  readonly rejectUnbarrable?: boolean;
}

/**
 * The Bouncer: rejects physically impossible voicings before scoring.
 *
 *  - **Max Span Rule:** a shape whose fretted span (max fret − min fret)
 *    exceeds `maxSpan` is discarded. The default of 4 matches the standard
 *    four-fret hand position; advanced players may raise it to 5.
 *  - **Finger Count Rule:** every fretted string needs a finger. Consecutive
 *    strings at the *same* fret can share one finger (a barre), but any
 *    fingering that would require five independent fingers is impossible —
 *    humans have four fretting fingers.
 *  - **Barre Logic:** a barre can only cover *consecutive* strings at one
 *    fret. Shapes that would need a barre to "skip" a string (e.g. frets on
 *    strings 1 and 6 with strings 2–5 elsewhere) are rejected only when
 *    `rejectUnbarrable` is set — some players can execute partial barres,
 *    so this is an opt-in stricter rule.
 *
 * Open strings and mutes take no fingers. The optional `tuning` parameter is
 * accepted for signature symmetry with the scoring functions; the rules above
 * only inspect the fret layout.
 */
export function isPhysicallyPlayable(
  shape: VoicingShape,
  _tuning?: ParsedTuning,
  options: PlayabilityOptions = {},
): boolean {
  const maxSpan = options.maxSpan ?? 4;
  const rejectUnbarrable = options.rejectUnbarrable ?? false;

  const fretted = shape.frets.filter((f): f is number => f !== null && f > 0);
  if (!fretted.length) return true; // All-muted is degenerate but not "impossible".

  const minFret = Math.min(...fretted);
  const maxFret = Math.max(...fretted);
  if (maxSpan > 0 && maxFret - minFret > maxSpan) return false;

  // Finger-count rule with barre support: consecutive strings sharing a fret
  // can be covered by one finger; everything else needs its own finger.
  // If the same fret recurs on non-adjacent strings (e.g. [1,1,3,4,5,1]),
  // the count stays 4 — one barre on the first run, one finger per other
  // run. This is the *default*: partial barres are allowed.
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

  // Strict barre logic (opt-in): a barre covers a *contiguous* run of strings
  // at one fret. If two non-adjacent strings share a fret and the strings
  // between them sound different frets, no single barre can cover both
  // without covering the middle — reject when the caller opts in.
  if (rejectUnbarrable) {
    const frettedIndexes = shape.frets
      .map((fret, index) => (fret !== null && fret > 0 ? index : -1))
      .filter((index) => index >= 0);
    for (let i = 0; i < frettedIndexes.length; i++) {
      const a = frettedIndexes[i];
      for (let j = i + 1; j < frettedIndexes.length; j++) {
        const b = frettedIndexes[j];
        if (shape.frets[a] === shape.frets[b] && b - a > 1) {
          // Between a and b there is at least one sounding string; if that
          // middle string's fret differs, the barre is impossible.
          for (let m = a + 1; m < b; m++) {
            if (shape.frets[m] !== null && shape.frets[m] !== shape.frets[a]) return false;
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

/**
 * Full feature vector — the input a learned re-ranker would consume. The
 * vector is intentionally stable: the offline Python pipeline (XGBoost /
 * Random Forest) will be trained on exactly these fields.
 */
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
  /** Number of independent fingers required (barre runs count once). */
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
 * Weights for the ergonomics cost model. Exported so tests and future ML
 * consume the exact same knobs the app uses.
 *
 * The weights are **not** mutated at runtime anymore: the online perceptron
 * (`applyFeedback`) has been removed in favor of an offline ML pipeline. The
 * exported `BASE_ERGONOMICS_WEIGHTS` are the shipped defaults; a future
 * JSON payload trained in Python can override them wholesale via the
 * `weights` parameter of `scoreErgonomics`.
 */
export const ERGONOMICS_WEIGHTS = {
  /** Each fret of left-hand position above the nut. */
  positionPerFret: 0.4,
  /** Each fret of overall left-hand span (min→max fretted), squared. */
  spanPerFret: 0.6,
  /** Each fret the index finger spans beyond its first (excluding barres), squared. */
  indexSpanPerFret: 0.8,
  /** Each fret fingers 2-4 span beyond the index (the "real" stretch), squared. */
  stretchPerFret: 1.0,
  /** Each barre. */
  barrePerBarre: 2.0,
  /** Each barre string covered beyond 2. */
  barreWidthPerString: 0.5,
  /** Extra penalty for a barre at position ≥ 7 (higher frets are harder). */
  barreHighFret: 3.0,
  /** Per open string, capped at 2 (only when the open mode allows them). */
  openPerString: -1.0,
  /** Per doubled chord tone (root/third/fifth doubled), capped at 1. */
  doublingPerTone: -0.5,
  /** Extra bonus for a doubled root (the most common real-world doubling). */
  rootDoubleBonus: -0.75,
  /** Extra penalty when the bass is not the chord root (weak bass). */
  bassNotRoot: 1.5,
  /** Per string index (0 = lowest) the bass sits on (thicker strings first). */
  bassStringPerString: 0.25,
  /** Flat penalty when a muted string sits between two sounding strings. */
  stringSkip: 2.5,
  /** Flat penalty when the thumb would have to fret (low fretted + high fretted 2+ frets up). */
  thumbFretting: 4.0,
  /** Exponent applied to stretch/span terms (2 = quadratic). */
  stretchExponent: 2,
  /** Fret-width compensation rate: `1 / (1 + position · fretWidthRate)`. */
  fretWidthRate: 0.05,
} as const;

export type ErgonomicsWeights = typeof ERGONOMICS_WEIGHTS;

/** Shipped default weights — the base an offline ML payload can override. */
export const BASE_ERGONOMICS_WEIGHTS: ErgonomicsWeights = ERGONOMICS_WEIGHTS;

/** Feature names that correspond to ergonomics factors (for UI hints). */
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
 * Estimate the finger shape of a voicing. Assumes the index finger takes the
 * lowest fretted fret and that strings sharing a fret under one finger form a
 * barre. This is an approximation — real fingering varies per player — but it
 * is deterministic, testable, and captures the physical cost of barres and
 * stretches that the current span-based ranking misses.
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

  // Barres: consecutive strings whose index finger (or shared finger) covers
  // the same fret.
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

  // Index span: fret range of the index finger, treating a barre as one stop.
  const indexFrets = new Set<number>();
  for (const { string, fret } of fretted) if (fingers[string] === 1) indexFrets.add(fret);
  const indexSpan = indexFrets.size ? Math.max(...indexFrets) - Math.min(...indexFrets) : 0;

  // Stretch span: fret range of fingers 2-4 (the real stretch).
  const stretchFrets = new Set<number>();
  for (const { string, fret } of fretted) if (fingers[string] !== 1) stretchFrets.add(fret);
  const stretchSpan = stretchFrets.size ? Math.max(...stretchFrets) - Math.min(...stretchFrets) : 0;

  return { fingers, barres, indexSpan, stretchSpan, position };
}

/**
 * Build the feature vector for a voicing. All features are derived from the
 * shape + tuning + chord context; this is the same vector a learned re-ranker
 * would consume. The vector is the exact input an offline ML pipeline
 * (XGBoost / Random Forest) will train on later — keep it stable.
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

  // Number of independent fingers: barre runs count as one finger each.
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

  // A muted string *between* two sounding strings needs awkward left-hand
  // muting or a right-hand palm mute.
  const hasStringSkip = frets.some(
    (fret, index) =>
      fret === null &&
      index > 0 &&
      index < n - 1 &&
      frets[index - 1] !== null &&
      frets[index + 1] !== null,
  );

  // The lowest sounding string is fretted, and the highest strings sit 2+
  // frets above it — that implies the thumb frets the low note, which is
  // advanced/situational, not a default voicing.
  let hasThumbFret = false;
  if (frets[0] !== null && frets[0] > 0) {
    for (const fret of frets.slice(1)) {
      if (fret !== null && fret > 0 && fret - (frets[0] ?? 0) >= THUMB_FRETTING_DELTA) {
        hasThumbFret = true;
        break;
      }
    }
  }

  // Bass note: the sounding note with the lowest MIDI pitch.
  let bassMidi = Infinity;
  let bassString = 0;
  for (const note of shape.sounding) {
    if (note.midi < bassMidi) {
      bassMidi = note.midi;
      bassString = note.stringIndex;
    }
  }
  const bassIsRoot = mod12(bassMidi - chord.rootPc) === 0;

  // Doublings among the sounding tones.
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
 * Total ergonomics cost of a voicing. Lower is better.
 *
 * The cost is a **non-linear** combination of the features with the exported
 * weights:
 *  - stretch terms are raised to `stretchExponent` (default 2) — a 4-fret
 *    stretch costs ~4× a 2-fret stretch, matching human hands;
 *  - every stretch/span term is scaled by `fretWidthFactor(position)` — frets
 *    get narrower up the neck, so the same absolute stretch is easier at the
 *    9th fret than at the 1st;
 *  - string-skipping (a muted string between two sounding ones) and
 *    thumb-fretting layouts get flat penalties, since they are disproportionately
 *    awkward rather than proportionally costly.
 *
 * The optional `weights` parameter lets a future offline-ML JSON payload
 * override the shipped base weights wholesale; it defaults to
 * {@link BASE_ERGONOMICS_WEIGHTS}. A shape that is impossible under the hard
 * rules never reaches here (the search filters it via `isPhysicallyPlayable`).
 */
export function scoreErgonomics(
  shape: VoicingShape,
  tuning: ParsedTuning,
  chord: ParsedChord,
  allowOpens = true,
  weights: ErgonomicsWeights = ERGONOMICS_WEIGHTS,
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
  if (!f.bassIsRoot) cost += w.bassNotRoot;
  cost += f.bassString * w.bassStringPerString;
  if (f.hasStringSkip) cost += w.stringSkip;
  if (f.hasThumbFret) cost += w.thumbFretting;

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
 * Viterbi-style pathfinding over a chord progression.
 *
 * A chord does not exist in isolation: the best voicing for a chord depends
 * on the voicing chosen for the previous chord. This function finds the
 * lowest **total** cost path — per-chord ergonomics plus the hand movement
 * (`transitionCost`) between adjacent voicings — with a forward dynamic
 * programming pass and backpointers, so the chosen path is globally optimal
 * rather than greedily optimal.
 *
 * Recurrence (i = chord index, j = voicing index):
 *   dp[i][j] = ergonomics(shapes[i][j])
 *            + min over k of ( dp[i-1][k] + transitionCost(shapes[i-1][k], shapes[i][j]) )
 *
 * Complexity: O(chords × shapesPerChord²) time, O(chords × shapesPerChord)
 * memory. `transitionCost` is unchanged (per-string fret deltas + position
 * delta); only the orchestration is new.
 *
 * @returns `cost` = total path cost (ergonomics + transitions), `choices` =
 *   per-chord ergonomics cost of the *best* voicing for that chord alone,
 *   `path` = the voicing index chosen for each chord.
 */
export function scoreProgressionVoicings(
  chords: readonly ParsedChord[],
  tuning: ParsedTuning,
  shapesPerChord: readonly (readonly VoicingShape[])[],
  weights: ErgonomicsWeights = BASE_ERGONOMICS_WEIGHTS,
): { cost: number; choices: readonly number[]; path: readonly number[] } {
  const count = Math.min(chords.length, shapesPerChord.length);
  if (count === 0) return { cost: 0, choices: [], path: [] };

  // dp[i][j] = lowest total cost ending at chord i with voicing j.
  const dp: number[][] = [];
  const back: number[][] = [];
  const choices: number[] = [];
  const shapeScores: number[][] = [];

  const first = shapesPerChord[0];
  if (first.length === 0) {
    dp.push([Infinity]);
    back.push([-1]);
  } else {
    dp.push(first.map((shape) => scoreErgonomics(shape, tuning, chords[0], true, weights).cost));
    back.push(new Array(first.length).fill(-1));
    shapeScores.push(dp[0]);
    choices.push(dp[0].length ? Math.min(...dp[0]) : Infinity);
  }

  for (let i = 1; i < count; i++) {
    const prev = shapesPerChord[i - 1];
    const current = shapesPerChord[i];
    const row: number[] = [];
    const backRow: number[] = [];
    const rowScores: number[] = [];

    if (current.length === 0) {
      dp.push([Infinity]);
      back.push([-1]);
      shapeScores.push([Infinity]);
      choices.push(Infinity);
      continue;
    }

    for (let j = 0; j < current.length; j++) {
      const ergo = scoreErgonomics(current[j], tuning, chords[i], true, weights).cost;
      rowScores.push(ergo);
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
    shapeScores.push(rowScores);
    choices.push(rowScores.length ? Math.min(...rowScores) : Infinity);
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

  // Unused guard to keep the linter happy (shapeScores reserved for ML labels).
  void shapeScores;

  return { cost: lastRow[bestJ], choices, path };
}

/**
 * Cost of moving between two voicings: per-string fret difference summed with
 * the hand-position delta. Lower is better. Open strings (fret 0) count as a
 * stable anchor (fret 0 = no movement).
 */
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
