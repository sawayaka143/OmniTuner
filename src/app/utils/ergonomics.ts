import { ParsedChord, ParsedTuning } from './chord-theory';
import { VoicingShape } from './chord-voicing';

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

export function fretWidthFactor(position: number): number {
  return 1 / (1 + position * 0.05);
}

export interface PlayabilityOptions {
  readonly maxSpan?: number;
  readonly rejectUnbarrable?: boolean;
}

export function isPhysicallyPlayable(
  shape: VoicingShape,
  _tuning?: ParsedTuning,
  options: PlayabilityOptions = {},
): boolean {
  const maxSpan = options.maxSpan ?? 4;
  const fretted = shape.frets.filter((f): f is number => f !== null && f > 0);
  if (!fretted.length) return true;
  const minFret = Math.min(...fretted);
  const maxFret = Math.max(...fretted);
  if (maxSpan > 0 && maxFret - minFret > maxSpan) return false;
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
  if (options.rejectUnbarrable) {
    const frettedIndexes = shape.frets
      .map((fret, index) => (fret !== null && fret > 0 ? index : -1))
      .filter((index) => index >= 0);
    for (let i = 0; i < frettedIndexes.length; i++) {
      const a = frettedIndexes[i];
      for (let j = i + 1; j < frettedIndexes.length; j++) {
        const b = frettedIndexes[j];
        if (shape.frets[a] === shape.frets[b] && b - a > 1) {
          for (let m = a + 1; m < b; m++) if (shape.frets[m] === null || shape.frets[m] !== shape.frets[a]) return false;
        }
      }
    }
  }
  return true;
}

export function filterPlayable(
  shapes: readonly VoicingShape[],
  tuning?: ParsedTuning,
  options?: PlayabilityOptions,
): VoicingShape[] {
  return shapes.filter((shape) => isPhysicallyPlayable(shape, tuning, options));
}

export interface Barre {
  readonly fret: number;
  readonly width: number;
  readonly startString: number;
}

export interface FingerShape {
  readonly fingers: readonly (number | null)[];
  readonly barres: readonly Barre[];
  readonly indexSpan: number;
  readonly stretchSpan: number;
  readonly position: number;
}

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
  readonly maxSpan: number;
  readonly hasStringSkip: boolean;
  readonly hasThumbFret: boolean;
}

export interface ErgonomicsScore {
  readonly cost: number;
  readonly features: ErgonomicsFeatures;
}

export const ERGONOMICS_WEIGHTS = {
  positionPerFret: 0.3,
  spanPerFret: 0.5,
  indexSpanPerFret: 0.7,
  stretchPerFret: 0.7,
  barrePerBarre: 1.2,
  barreWidthPerString: 0.5,
  barreHighFret: 2.0,
  openPerString: -1.0,
  doublingPerTone: 1.1,
  rootDoubleBonus: -0.25,
  bassNotRoot: 0.5,
  bassStringPerString: 0.2,
  stringSkip: 2.5,
  thumbFretting: 4.0,
  stretchExponent: 2,
  fretWidthRate: 0.05,
  noteCountPerNote: -0.2,
} as const;

export type ErgonomicsWeights = typeof ERGONOMICS_WEIGHTS;

export const BASE_ERGONOMICS_WEIGHTS: ErgonomicsWeights = ERGONOMICS_WEIGHTS;

export function detectFingers(frets: readonly (number | null)[]): FingerShape {
  const n = frets.length;
  const fretted: { string: number; fret: number }[] = [];
  for (let s = 0; s < n; s++) {
    const fret = frets[s];
    if (fret !== null && fret > 0) fretted.push({ string: s, fret });
  }
  const position = fretted.length ? Math.min(...fretted.map((f) => f.fret)) : 0;
  const fingers: (number | null)[] = new Array(n).fill(null);
  const ordered = [...fretted].sort((a, b) => a.fret - b.fret || a.string - b.string);
  let nextFinger = 2;
  for (const { string, fret } of ordered) {
    if (fret === position) fingers[string] = 1;
    else fingers[string] = Math.min(nextFinger++, 4);
  }
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
  const fingeredCount = new Set(finger.fingers.filter((f): f is number => f !== null)).size;
  let maxSpan = 0;
  const frettedIndexes = frets
    .map((fret, index) => (fret !== null && fret > 0 ? index : -1))
    .filter((index) => index >= 0);
  for (let i = 1; i < frettedIndexes.length; i++) {
    const a = frettedIndexes[i - 1];
    const b = frettedIndexes[i];
    maxSpan = Math.max(maxSpan, (frets[b] ?? 0) - (frets[a] ?? 0));
  }
  const hasStringSkip = frets.some(
    (fret, index) =>
      fret === null && index > 0 && index < n - 1 && frets[index - 1] !== null && frets[index + 1] !== null,
  );
  let hasThumbFret = false;
  if (frets[0] !== null && frets[0] > 0) {
    for (const fret of frets.slice(1)) {
      if (fret !== null && fret > 0 && fret - (frets[0] ?? 0) >= 2) {
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
  const doublingCount = (f.rootDoubled ? 1 : 0) + (f.thirdDoubled ? 1 : 0) + (f.fifthDoubled ? 1 : 0);
  cost += Math.min(doublingCount, 1) * w.doublingPerTone;
  if (f.rootDoubled) cost += w.rootDoubleBonus;
  cost += (f.noteCount - 1) * w.noteCountPerNote;
  if (!f.bassIsRoot) cost += w.bassNotRoot;
  cost += f.bassString * w.bassStringPerString;
  if (f.hasStringSkip) cost += w.stringSkip;
  if (f.hasThumbFret) cost += w.thumbFretting;
  if (jitter > 0) cost += Math.random() * jitter;
  return { cost, features: f };
}

export function scoreProgressionVoicings(
  chords: readonly ParsedChord[],
  tuning: ParsedTuning,
  shapesPerChord: readonly (readonly VoicingShape[])[],
  weights: ErgonomicsWeights = BASE_ERGONOMICS_WEIGHTS,
  jitter = 0,
): { cost: number; choices: readonly number[]; path: readonly number[] } {
  const count = Math.min(chords.length, shapesPerChord.length);
  if (count === 0) return { cost: 0, choices: [], path: [] };
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
