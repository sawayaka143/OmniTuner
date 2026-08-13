import { ParsedChord, ParsedTuning } from './chord-theory';
import { isPhysicallyPlayable, scoreErgonomics } from './ergonomics';

export const MAX_FRET = 12;
export const RESULTS_PER_CHORD = 5;

const RAW_CAP = 5000;

export type OpenStringMode = 'allow' | 'require' | 'mostly' | 'exclude';

export const OPEN_MODE_DESCRIPTIONS: Readonly<Record<OpenStringMode, string>> = {
  allow: 'open strings may ring anywhere — no constraint',
  require: 'every shape must include at least one open string',
  mostly: 'majority of the sounding notes must be open — drone-like voicings',
  exclude: 'pure closed voicings — every sounding string is fretted',
};

export const OPEN_MODE_SUMMARIES: Readonly<Record<OpenStringMode, string>> = {
  allow: 'open strings free',
  require: '≥1 open string required',
  mostly: 'mostly open (majority of notes open)',
  exclude: 'no open strings',
};

export interface VoicingOptions {
  readonly openMode: OpenStringMode;
  readonly allowInversions: boolean;
  readonly allowGaps: boolean;
  /** Maximum fret span of a voicing (max fretted fret − min fretted fret). */
  readonly maxStretch: number;
  readonly minNotes: number;
  /**
   * Reject shapes whose fretted strings can only be covered by impossible
   * barres (e.g. same fret on non-adjacent strings). Defaults to false.
   */
  readonly rejectUnbarrable?: boolean;
  /**
   * How many top shapes to return (defaults to `RESULTS_PER_CHORD`). Callers
   * that randomize may want a wider candidate pool (e.g. 12) and then jitter
   * the ranking so fresh-but-still-good voicings surface.
   */
  readonly candidateCount?: number;
}

/** Optional per-shape feedback applied during search: adjusts the cost and
 *  lets the caller veto disliked shapes before ranking. */
export interface VoicingFeedbackHook {
  /** Adjust the ergonomics cost for a shape (e.g. user likes/dislikes). */
  readonly adjustCost?: (shape: VoicingShape, baseCost: number) => number;
  /** Return true to drop the shape entirely (e.g. user disliked it). */
  readonly excludeShape?: (shape: VoicingShape) => boolean;
}

export interface SoundingNote {
  readonly stringIndex: number;
  readonly fret: number;
  readonly midi: number;
}

export interface VoicingShape {
  /** Per-string fret; null = muted. Index 0 is the lowest string. */
  readonly frets: readonly (number | null)[];
  readonly sounding: readonly SoundingNote[];
  readonly span: number;
  readonly bassMidi: number;
  readonly bassIsRoot: boolean;
  readonly position: number;
  readonly openCount: number;
  /** Ergonomics cost of the shape (lower = easier). Populated after search. */
  readonly cost: number;
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

function makeShape(
  frets: (number | null)[],
  tuning: ParsedTuning,
  chord: ParsedChord,
): VoicingShape {
  const sounding: SoundingNote[] = [];
  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i];
    if (fret !== null) {
      sounding.push({ stringIndex: i, fret, midi: tuning.midi[i] + fret });
    }
  }
  const frettedOnly = frets.filter((f): f is number => f !== null && f > 0);
  const span = frettedOnly.length ? Math.max(...frettedOnly) - Math.min(...frettedOnly) : 0;
  let bass = Infinity;
  for (const note of sounding) if (note.midi < bass) bass = note.midi;
  const bassIsRoot = mod12(bass - chord.rootPc) === 0;
  const position = frettedOnly.length ? Math.min(...frettedOnly) : 0;
  const openCount = frets.filter((f) => f === 0).length;
  return { frets, sounding, span, bassMidi: bass, bassIsRoot, position, openCount, cost: 0 };
}

function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Depth-first search over strings × candidate frets with suffix pruning
 * (coverage, open availability). Returns the top shapes, best ergonomics
 * first. Physically impossible shapes are rejected by `isPhysicallyPlayable`
 * before scoring.
 */
export function searchChord(
  tuning: ParsedTuning,
  chord: ParsedChord,
  options: VoicingOptions,
  feedback?: VoicingFeedbackHook,
): VoicingShape[] {
  const n = tuning.midi.length;
  const pcs = new Set(chord.pcs);
  // Optional tones (11ths/13ths) may ring but needn't be covered.
  const optional = new Set(chord.optionalPcs);
  const required = new Set(chord.pcs.filter((pc) => !optional.has(pc)));

  // Candidate frets per string that produce a chord tone.
  const candidates: number[][] = [];
  for (let s = 0; s < n; s++) {
    const frets: number[] = [];
    for (let f = 0; f <= MAX_FRET; f++) {
      if (pcs.has(mod12(tuning.midi[s] + f))) frets.push(f);
    }
    candidates.push(frets);
  }

  // Suffix summaries for pruning.
  const suffixCover: Set<number>[] = new Array(n + 1);
  const suffixHasOpen: boolean[] = new Array(n + 1).fill(false);
  const suffixOpenCount: number[] = new Array(n + 1).fill(0);
  suffixCover[n] = new Set();
  for (let s = n - 1; s >= 0; s--) {
    suffixCover[s] = new Set(suffixCover[s + 1]);
    let hasOpen = false;
    for (const fret of candidates[s]) {
      suffixCover[s].add(mod12(tuning.midi[s] + fret));
      if (fret === 0) hasOpen = true;
    }
    suffixHasOpen[s] = suffixHasOpen[s + 1] || hasOpen;
    suffixOpenCount[s] = suffixOpenCount[s + 1] + (hasOpen ? 1 : 0);
  }

  const minNotes = Math.max(1, Math.min(options.minNotes, n));
  const mostlyNeed = options.openMode === 'mostly' ? Math.floor(minNotes / 2) + 1 : 0;

  const allowOpens = options.openMode !== 'exclude';
  const results: VoicingShape[] = [];
  const frets: (number | null)[] = new Array(n).fill(null);
  const covered = new Set<number>();

  const dfs = (s: number, voiced: number, gapClosed: boolean, openCount: number): void => {
    if (results.length >= RAW_CAP) return;
    for (const pc of required) {
      if (!covered.has(pc) && !suffixCover[s].has(pc)) return;
    }
    if (voiced + (n - s) < minNotes) return;
    if (options.openMode === 'require' && openCount === 0 && !suffixHasOpen[s]) return;
    if (options.openMode === 'mostly' && openCount + suffixOpenCount[s] < mostlyNeed) return;

    if (s === n) {
      if (voiced >= minNotes && covered.size === required.size) {
        if (options.openMode === 'require' && openCount === 0) return;
        if (options.openMode === 'mostly' && openCount * 2 <= voiced) return;
        const shape = makeShape(frets.slice(), tuning, chord);
        // The Bouncer: reject physically impossible shapes before ranking.
        if (
          !isPhysicallyPlayable(shape, tuning, {
            maxSpan: options.maxStretch,
            rejectUnbarrable: options.rejectUnbarrable,
          })
        )
          return;
        if (!options.allowInversions && !shape.bassIsRoot) return;
        if (feedback?.excludeShape?.(shape)) return;
        const baseCost = scoreErgonomics(shape, tuning, chord, allowOpens).cost;
        results.push({
          ...shape,
          cost: feedback?.adjustCost ? feedback.adjustCost(shape, baseCost) : baseCost,
        });
      }
      return;
    }

    // Branch A: mute this string.
    frets[s] = null;
    dfs(s + 1, voiced, gapClosed || (voiced > 0 && !options.allowGaps), openCount);

    // Branch B: sound a chord tone (once a gap has closed, the rest must mute).
    if (!gapClosed) {
      for (const fret of candidates[s]) {
        if (options.openMode === 'exclude' && fret === 0) continue;
        frets[s] = fret;
        const pc = mod12(tuning.midi[s] + fret);
        const newlyCovered = required.has(pc) && !covered.has(pc);
        if (newlyCovered) covered.add(pc);
        dfs(s + 1, voiced + 1, gapClosed, openCount + (fret === 0 ? 1 : 0));
        if (newlyCovered) covered.delete(pc);
      }
    }
    frets[s] = null;
  };
  dfs(0, 0, false, 0);

  const rankOf = (shape: VoicingShape): number[] => [shape.cost, shape.span, shape.position];
  results.sort((a, b) =>
    options.openMode === 'mostly'
      ? compareRanks([-a.openCount, ...rankOf(a)], [-b.openCount, ...rankOf(b)])
      : compareRanks(rankOf(a), rankOf(b)),
  );
  const candidateCount = options.candidateCount ?? RESULTS_PER_CHORD;
  return results.slice(0, candidateCount);
}
