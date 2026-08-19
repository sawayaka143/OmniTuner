import { ParsedChord, ParsedTuning } from './chord-theory';

export const MAX_FRET = 12;
export const RESULTS_PER_CHORD = 6;

const MAX_SPAN = 4;
const MAX_THUMB_REACH = 4;
const MIN_NOTES = 3;
const MIN_DISTINCT = 3;

export interface SoundingNote {
  readonly stringIndex: number;
  readonly fret: number;
  readonly midi: number;
}

export interface VoicingShape {
  readonly frets: readonly (number | null)[];
  readonly sounding: readonly SoundingNote[];
  readonly span: number;
  readonly bassMidi: number;
  readonly bassIsRoot: boolean;
  readonly position: number;
  readonly openCount: number;
  readonly cost: number;
}

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
  readonly maxStretch: number;
  readonly minNotes: number;
  readonly rejectUnbarrable?: boolean;
  readonly candidateCount?: number;
}

export interface VoicingFeedbackHook {
  readonly adjustCost?: (shape: VoicingShape, baseCost: number) => number;
  readonly excludeShape?: (shape: VoicingShape) => boolean;
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

type Diagram = (number | null)[];

const diagramToKey = (diagram: Diagram): string =>
  diagram.map((f) => (f === null ? 'x' : String(f))).join(',');

interface ChordOptions {
  readonly note_curve: Readonly<Record<number, number>>;
  readonly default_note_penalty: number;
  readonly open_penalty_threshold: number;
  readonly open_penalty_per: number;
  readonly upper_span_limit: number;
  readonly upper_span_penalty_per_semitone: number;
  readonly low_halfstep_penalty: number;
  readonly low_wholestep_penalty: number;
  readonly root_bias: number;
  readonly doubling_multiplier: number;
}

const VOICING_STYLES: Readonly<Record<string, ChordOptions>> = {
  open_pop: {
    note_curve: { 3: 50, 4: 80, 5: 92, 6: 96 },
    default_note_penalty: -25,
    open_penalty_threshold: 3,
    open_penalty_per: 25,
    upper_span_limit: 17,
    upper_span_penalty_per_semitone: 2,
    low_halfstep_penalty: 12,
    low_wholestep_penalty: 6,
    root_bias: 120,
    doubling_multiplier: 1.0,
  },
  jazz_comping: {
    note_curve: { 3: 45, 4: 92, 5: 40, 6: -35 },
    default_note_penalty: -35,
    open_penalty_threshold: 3,
    open_penalty_per: 30,
    upper_span_limit: 12,
    upper_span_penalty_per_semitone: 5,
    low_halfstep_penalty: 25,
    low_wholestep_penalty: 10,
    root_bias: 140,
    doubling_multiplier: 1.2,
  },
};

const TEMPLATE_BONUSES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  Cm: {
    'x,3,5,5,4,3': 300,
    '8,10,10,8,8,8': 300,
    'x,3,5,5,4,x': 250,
    '8,10,10,8,x,x': 220,
  },
  C: {
    'x,3,2,0,1,0': 300,
    '8,10,10,9,8,8': 300,
    'x,3,5,5,5,3': 280,
  },
  G: {
    '3,2,0,0,0,3': 300,
    '3,2,0,0,3,3': 300,
    '3,5,5,4,3,3': 280,
  },
  Cm7: {
    'x,3,5,3,4,3': 300,
    '8,10,8,8,8,8': 300,
    'x,3,5,3,4,x': 270,
    'x,3,1,3,4,x': 260,
    '8,x,8,8,8,x': 250,
    '8,10,8,8,x,x': 240,
  },
  Cm9: {
    'x,3,1,3,3,x': 350,
    '8,6,8,8,8,x': 320,
    'x,3,5,3,3,3': 220,
  },
  Dm9: {
    'x,5,3,5,5,x': 350,
    '10,8,10,10,10,x': 320,
    'x,5,7,5,6,5': 220,
  },
  Gmaj7: { '3,x,4,4,3,x': 250 },
  B7: { 'x,2,1,2,0,2': 250 },
  C7: { 'x,3,2,3,1,0': 250, 'x,3,2,3,1,x': 250 },
  Em7: { '0,2,0,0,0,0': 250 },
  'C#m7b5': { 'x,4,5,4,5,x': 250 },
  D7: { 'x,x,0,2,1,2': 250 },
};

const GUIDE_INTERVALS = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 18, 20, 21]);
const JAZZ_QUALITIES = new Set(['maj7', 'dom7', 'm7', 'm7b5', 'dim7', '7']);

const resolveStyle = (chord: ParsedChord): ChordOptions => {
  const q = chord.quality;
  if (JAZZ_QUALITIES.has(q)) return VOICING_STYLES['jazz_comping'];
  if (q.includes('maj7') || q.includes('m7b5') || q.includes('ø')) return VOICING_STYLES['jazz_comping'];
  if (chord.intervals.includes(11) || chord.intervals.includes(10)) return VOICING_STYLES['jazz_comping'];
  return VOICING_STYLES['open_pop'];
};

function makeShape(
  frets: (number | null)[],
  tuning: ParsedTuning,
  chord: ParsedChord,
  cost: number,
): VoicingShape {
  const sounding: SoundingNote[] = [];
  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i];
    if (fret !== null) sounding.push({ stringIndex: i, fret, midi: tuning.midi[i] + fret });
  }
  const frettedOnly = frets.filter((f): f is number => f !== null && f > 0);
  const span = frettedOnly.length ? Math.max(...frettedOnly) - Math.min(...frettedOnly) : 0;
  let bass = Infinity;
  for (const note of sounding) if (note.midi < bass) bass = note.midi;
  const bassIsRoot = sounding.length ? mod12(bass - chord.rootPc) === 0 : false;
  const position = frettedOnly.length ? Math.min(...frettedOnly) : 0;
  const openCount = frets.filter((f) => f === 0).length;
  return { frets: frets.slice(), sounding, span, bassMidi: bass, bassIsRoot, position, openCount, cost };
}

class BiomechanicalEngine {
  private readonly tuning: ParsedTuning;
  private readonly chord: ParsedChord;
  private readonly pcs: Set<number>;
  private readonly requiredPcs: Set<number>;
  private readonly style: ChordOptions;
  private readonly options: (number | null)[][];

  constructor(tuning: ParsedTuning, chord: ParsedChord) {
    this.tuning = tuning;
    this.chord = chord;
    this.pcs = new Set(chord.pcs);
    const optional = new Set(chord.optionalPcs);
    this.requiredPcs = new Set(chord.pcs.filter((pc) => !optional.has(pc)));
    this.style = resolveStyle(chord);
    this.options = this.buildStringOptions();
  }

  private buildStringOptions(): (number | null)[][] {
    const options: (number | null)[][] = [];
    for (let s = 0; s < this.tuning.midi.length; s++) {
      const stringOpts: (number | null)[] = [null];
      for (let fret = 0; fret <= MAX_FRET; fret++) {
        if (this.pcs.has(mod12(this.tuning.midi[s] + fret))) stringOpts.push(fret);
      }
      options.push(stringOpts);
    }
    return options;
  }

  generate(limit: number = RESULTS_PER_CHORD): [number, Diagram][] {
    const n = this.tuning.midi.length;
    const suffixCover: Set<number>[] = new Array(n + 1);
    suffixCover[n] = new Set();
    for (let s = n - 1; s >= 0; s--) {
      suffixCover[s] = new Set(suffixCover[s + 1]);
      for (const fret of this.options[s]) {
        if (fret === null) continue;
        suffixCover[s].add(mod12(this.tuning.midi[s] + fret));
      }
    }

    const seen = new Set<string>();
    const scored: [number, Diagram][] = [];
    const current: Diagram = [];
    const covered = new Set<number>();

    const dfs = (idx: number, voiced: number): void => {
      for (const pc of this.requiredPcs) if (!covered.has(pc) && !suffixCover[idx].has(pc)) return;
      if (voiced + (n - idx) < MIN_NOTES) return;
      const pcsNow = this.pcsForPartial(current, covered);
      if (pcsNow.size + (n - idx) < MIN_DISTINCT) return;

      if (idx === n) {
        const key = diagramToKey(current);
        if (seen.has(key)) return;
        seen.add(key);
        if (!this.isValid(current)) return;
        scored.push([this.score(current), [...current]]);
        return;
      }

      for (const fret of this.options[idx]) {
        current.push(fret);
        let added = false;
        let pc: number | null = null;
        if (fret !== null) {
          pc = mod12(this.tuning.midi[idx] + fret);
          if (this.requiredPcs.has(pc) && !covered.has(pc)) {
            covered.add(pc);
            added = true;
          }
        }
        dfs(idx + 1, voiced + (fret !== null ? 1 : 0));
        if (added && pc !== null) covered.delete(pc);
        current.pop();
      }
    };

    dfs(0, 0);

    scored.sort((a, b) => {
      const ka = this.sortKey(a[0], a[1]);
      const kb = this.sortKey(b[0], b[1]);
      for (let i = 0; i < ka.length; i++) {
        const va = ka[i] as number | number[];
        const vb = kb[i] as number | number[];
        if (Array.isArray(va) && Array.isArray(vb)) {
          for (let j = 0; j < va.length; j++) if (va[j] !== vb[j]) return (va[j] as number) - (vb[j] as number);
        } else if (va !== vb) return (va as number) - (vb as number);
      }
      return 0;
    });

    return scored.slice(0, limit);
  }

  private pcsForPartial(partial: Diagram, covered: Set<number>): Set<number> {
    const s = new Set<number>(covered);
    for (let i = 0; i < partial.length; i++) {
      const fret = partial[i];
      if (fret === null) continue;
      const pc = mod12(this.tuning.midi[i] + fret);
      if (this.pcs.has(pc)) s.add(pc);
    }
    return s;
  }

  private playedIndices(diagram: Diagram): number[] {
    const indices: number[] = [];
    diagram.forEach((f, i) => {
      if (f !== null) indices.push(i);
    });
    return indices;
  }

  private pcAt(stringIdx: number, fret: number): number {
    return mod12(this.tuning.midi[stringIdx] + fret);
  }

  private pcsForDiagram(diagram: Diagram): Set<number> {
    return new Set(this.playedIndices(diagram).map((i) => this.pcAt(i, diagram[i]!)));
  }

  private bassIntervalForDiagram(diagram: Diagram): number | null {
    const played = this.playedIndices(diagram);
    if (!played.length) return null;
    const bassPc = this.pcAt(played[0], diagram[played[0]]!);
    return mod12(bassPc - this.chord.rootPc);
  }

  private isSubset(sub: Set<number>, sup: Set<number>): boolean {
    for (const item of sub) if (!sup.has(item)) return false;
    return true;
  }

  private isValid(diagram: Diagram): boolean {
    const played = this.playedIndices(diagram);
    if (played.length < MIN_NOTES) return false;
    const pcs = this.pcsForDiagram(diagram);
    if (pcs.size < MIN_DISTINCT && this.requiredPcs.size >= MIN_DISTINCT) return false;
    if (!this.isSubset(this.requiredPcs, pcs)) return false;
    if (!this.dampingOk(diagram, played)) return false;
    if (!this.frettedCountOk(diagram)) return false;
    if (!this.spanOk(diagram)) return false;
    return true;
  }

  private dampingOk(diagram: Diagram, played: number[]): boolean {
    if (played.length < 2) return true;
    const minP = Math.min(...played);
    const maxP = Math.max(...played);
    for (let i = minP + 1; i < maxP; i++) {
      if (diagram[i] === null) {
        const ok = [-1, 1].some((adj) => {
          const adjIdx = i + adj;
          return (
            adjIdx >= 0 &&
            adjIdx < diagram.length &&
            diagram[adjIdx] !== null &&
            diagram[adjIdx]! > 0
          );
        });
        if (!ok) return false;
      }
    }
    return true;
  }

  private spanOk(diagram: Diagram): boolean {
    const positives = diagram.filter((f): f is number => f !== null && f > 0) as number[];
    if (!positives.length) return true;
    if (Math.max(...positives) - Math.min(...positives) <= MAX_SPAN) return true;
    const thumbF = diagram[0];
    if (thumbF !== null && thumbF > 0 && diagram.length >= 4) {
      const others = diagram.filter((f, i) => i !== 0 && f !== null && f > 0) as number[];
      if (
        others.length &&
        Math.max(...others) - Math.min(...others) <= MAX_SPAN &&
        thumbF <= Math.min(...others) &&
        Math.min(...others) - thumbF <= MAX_THUMB_REACH
      )
        return true;
    }
    return false;
  }

  private frettedCountOk(diagram: Diagram): boolean {
    const positives = diagram.filter((f): f is number => f !== null && f > 0);
    if (!positives.length) return true;
    return this.minFingersRequired(diagram) <= 4;
  }

  private minFingersRequired(diagram: Diagram): number {
    const n = diagram.length;
    const INF = 99;
    const dp = Array(n + 1).fill(INF);
    dp[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
      const v = diagram[i];
      if (v === null || v === 0) {
        dp[i] = dp[i + 1];
        continue;
      }
      const f = v;
      let best = INF;
      for (let j = i; j < n; j++) {
        const w = diagram[j];
        if (w === 0 || (w !== null && w > 0 && w !== f)) break;
        if (w === f) {
          const candidate = 1 + dp[j + 1];
          if (candidate < best) best = candidate;
        }
      }
      dp[i] = best;
    }
    return dp[0];
  }

  private score(diagram: Diagram): number {
    const played = this.playedIndices(diagram);
    const pcs = this.pcsForDiagram(diagram);
    const noteCount = played.length;
    const distinct = pcs.size;
    const style = this.style;
    let score = 0;
    score += style.note_curve[noteCount] ?? style.default_note_penalty;
    score += distinct * 28;

    const bassInterval = this.bassIntervalForDiagram(diagram);
    if (bassInterval === 0) score += style.root_bias;
    else score -= 150;

    const hasExtension = this.chord.intervals.some((iv) => [13, 14, 15, 18, 20, 21].includes(iv));
    const hi = diagram.length - 1;
    const hiPrev = diagram.length - 2;
    if (hasExtension && diagram.length >= 2) {
      if (diagram[hi] === null) score += 60;
      else if (diagram[hi] !== null && diagram[hi] === diagram[hiPrev] && diagram[hi]! > 0) score -= 70;
    }

    for (let i = 0; i < diagram.length - 1; i++) {
      if (diagram[i] !== null && diagram[i]! > 0) {
        for (let j = i + 1; j < Math.min(i + 3, diagram.length); j++) {
          if (diagram[j] !== null && diagram[j]! > 0 && diagram[i]! > diagram[j]! + 1) {
            score -= (diagram[i]! - diagram[j]!) * 50;
          }
        }
      }
    }

    const positives = diagram.filter((f): f is number => f !== null && f > 0) as number[];
    const maxFret = positives.length ? Math.max(...positives) : 0;
    const openCount = diagram.filter((f) => f === 0).length;
    if (maxFret >= style.open_penalty_threshold) score -= openCount * style.open_penalty_per;

    if (diagram.length >= 2 && diagram[hi] !== null && diagram[hiPrev] === null) score -= 40;

    if (diagram.length === 6) {
      const bonuses = TEMPLATE_BONUSES[this.chord.symbol] ?? {};
      const key = diagramToKey(diagram);
      if (bonuses[key] !== undefined) score += bonuses[key];
    }

    score -= this.minFingersRequired(diagram) * 10;
    return score;
  }

  private sortKey(score: number, diagram: Diagram): unknown[] {
    const played = this.playedIndices(diagram);
    const positives = diagram.filter((f): f is number => f !== null && f > 0) as number[];
    const maxF = positives.length ? Math.max(...positives) : 0;
    const minF = positives.length ? Math.min(...positives) : 0;
    const span = maxF ? maxF - minF : 0;
    return [-score, -played.length, span, maxF, diagram.map((f) => (f === null ? -1 : f))];
  }
}

export function searchChord(
  tuning: ParsedTuning,
  chord: ParsedChord,
  _options?: VoicingOptions,
  _feedback?: VoicingFeedbackHook,
): VoicingShape[] {
  const engine = new BiomechanicalEngine(tuning, chord);
  const ranked = engine.generate(RESULTS_PER_CHORD);
  return ranked.map(([score, diagram]) => makeShape(diagram.slice(), tuning, chord, score));
}
