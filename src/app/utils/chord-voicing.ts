import { CHORD_FORMS, ChordForm } from '../data/chord-forms';
import { ParsedChord, ParsedTuning } from './chord-theory';

export const MAX_FRET = 12;
export const RESULTS_PER_CHORD = 6;

const MAX_SPAN = 4;
const MAX_THUMB_REACH = 4;
const MIN_NOTES = 3;
const MIN_DISTINCT = 3;
// Highest fretted note at which a shape still counts as an open-position voicing.
const OPEN_IDIOM_MAX_POSITION = 2;
// A grip is only idiomatic while it sits low enough on the neck to be a shape a player
// reaches for, so the library bonus decays with the fret it lands on: the E-shape Eb at
// fret 6 is a first choice, the same grip at fret 11 is not.
const FORM_POSITION_TAPER = 2;

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

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

type Diagram = (number | null)[];

const diagramToKey = (diagram: Diagram): string =>
  diagram.map((f) => (f === null ? 'x' : String(f))).join(',');

// A form is stored as fret offsets from the string carrying the root, so one entry
// generates its shape in every key. Returns null when the grip does not fit the tuning
// (non-six-string instruments) or would run off the neck in this key.
export function instantiateForm(
  form: ChordForm,
  tuning: ParsedTuning,
  rootPc: number,
): Diagram | null {
  if (form.offsets.length !== tuning.midi.length) return null;
  const anchorFret = mod12(rootPc - mod12(tuning.midi[form.anchor]));
  const diagram: Diagram = [];
  for (const offset of form.offsets) {
    if (offset === null) {
      diagram.push(null);
      continue;
    }
    const fret = anchorFret + offset;
    if (fret < 0 || fret > MAX_FRET) return null;
    diagram.push(fret);
  }
  return diagram;
}

interface ChordOptions {
  readonly note_curve: Readonly<Record<number, number>>;
  readonly default_note_penalty: number;
  readonly open_penalty_threshold: number;
  readonly open_penalty_per: number;
  readonly upper_span_limit: number;
  readonly upper_span_penalty_per_semitone: number;
  readonly position_penalty_per_fret: number;
  readonly root_bias: number;
}

const VOICING_STYLES: Readonly<Record<string, ChordOptions>> = {
  open_pop: {
    note_curve: { 3: 50, 4: 80, 5: 92, 6: 96 },
    default_note_penalty: -25,
    open_penalty_threshold: 5,
    open_penalty_per: 25,
    upper_span_limit: 24,
    upper_span_penalty_per_semitone: 2,
    position_penalty_per_fret: 6,
    root_bias: 120,
  },
  jazz_comping: {
    note_curve: { 3: 45, 4: 92, 5: 80, 6: -35 },
    default_note_penalty: -35,
    open_penalty_threshold: 5,
    open_penalty_per: 30,
    upper_span_limit: 18,
    upper_span_penalty_per_semitone: 5,
    position_penalty_per_fret: 6,
    root_bias: 140,
  },
};

const JAZZ_QUALITIES = new Set(['maj7', 'm7', 'm7b5', 'dim7', '7']);

const resolveStyle = (chord: ParsedChord): ChordOptions => {
  const q = chord.quality;
  if (JAZZ_QUALITIES.has(q)) return VOICING_STYLES['jazz_comping'];
  if (q.includes('maj7') || q.includes('m7b5') || q.includes('ø'))
    return VOICING_STYLES['jazz_comping'];
  if (chord.intervals.includes(11) || chord.intervals.includes(10))
    return VOICING_STYLES['jazz_comping'];
  return VOICING_STYLES['open_pop'];
};

export const EXTENSION_INTERVALS: readonly number[] = [13, 14, 15, 17, 18, 20, 21];

// The natural fifth becomes voicing-neutral once the chord carries its guide tones
// (third plus seventh/sixth). Altered fifths are colour tones and stay required.
// Extension tones are handled by requiredExtensionChoices: a voicing needs one of them,
// not all of them, so 13 chords can be voiced R-b7-3-13 as well as R-3-b7-9.
export function requiredPitchClasses(chord: ParsedChord): ReadonlySet<number> {
  const optional = new Set(chord.optionalPcs);
  const hasThird = chord.intervals.includes(3) || chord.intervals.includes(4);
  const hasGuideTone = [9, 10, 11].some((interval) => chord.intervals.includes(interval));
  const dropFifth = hasThird && hasGuideTone;
  return new Set(
    chord.pcs.filter((pc, index) => {
      if (optional.has(pc)) return false;
      const interval = chord.intervals[index];
      if (EXTENSION_INTERVALS.includes(interval)) return false;
      return !(dropFifth && interval === 7);
    }),
  );
}

export function requiredExtensionChoices(chord: ParsedChord): readonly number[] {
  return chord.pcs.filter((_, index) => EXTENSION_INTERVALS.includes(chord.intervals[index]));
}

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
  return {
    frets: frets.slice(),
    sounding,
    span,
    bassMidi: bass,
    bassIsRoot,
    position,
    openCount,
    cost,
  };
}

class BiomechanicalEngine {
  private readonly tuning: ParsedTuning;
  private readonly chord: ParsedChord;
  private readonly pcs: Set<number>;
  private readonly requiredPcs: ReadonlySet<number>;
  private readonly requiredAnyOf: readonly number[];
  private readonly enforceExtensions: boolean;
  private readonly style: ChordOptions;
  private readonly options: (number | null)[][];
  private readonly bassPc: number | undefined;
  private readonly slashBass: number | undefined;
  private readonly formWeights: ReadonlyMap<string, number>;
  private readonly formDiagrams: ReadonlyMap<string, Diagram>;

  constructor(
    tuning: ParsedTuning,
    chord: ParsedChord,
    enforceBass: boolean = false,
    enforceExtensions: boolean = true,
  ) {
    this.tuning = tuning;
    this.chord = chord;
    this.pcs = new Set(chord.pcs);
    this.requiredPcs = requiredPitchClasses(chord);
    this.requiredAnyOf = requiredExtensionChoices(chord);
    this.enforceExtensions = enforceExtensions;
    this.style = resolveStyle(chord);
    this.bassPc = enforceBass ? chord.bassPc : undefined;
    // A slash bass is usually not a chord tone (G under Am, D under C), so it is offered on
    // every string; the bass filter and the lowest-string rule in the search place it.
    this.slashBass =
      this.bassPc !== undefined && !this.pcs.has(this.bassPc) ? this.bassPc : undefined;
    this.options = this.buildStringOptions();

    const formWeights = new Map<string, number>();
    const formDiagrams = new Map<string, Diagram>();
    for (const form of CHORD_FORMS) {
      if (!form.qualities.includes(chord.quality)) continue;
      const diagram = instantiateForm(form, tuning, chord.rootPc);
      if (!diagram) continue;
      const key = diagramToKey(diagram);
      formWeights.set(key, form.weight);
      formDiagrams.set(key, diagram);
    }
    this.formWeights = formWeights;
    this.formDiagrams = formDiagrams;
  }

  private buildStringOptions(): (number | null)[][] {
    const options: (number | null)[][] = [];
    for (let s = 0; s < this.tuning.midi.length; s++) {
      const stringOpts: (number | null)[] = [null];
      for (let fret = 0; fret <= MAX_FRET; fret++) {
        const pc = mod12(this.tuning.midi[s] + fret);
        if (this.pcs.has(pc) || pc === this.slashBass) stringOpts.push(fret);
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
      if (
        this.enforceExtensions &&
        this.requiredAnyOf.length &&
        !this.requiredAnyOf.some((pc) => covered.has(pc) || suffixCover[idx].has(pc))
      )
        return;
      if (voiced + (n - idx) < MIN_NOTES) return;
      const pcsNow = this.pcsForPartial(current, covered);
      if (pcsNow.size + (n - idx) < MIN_DISTINCT && this.requiredPcs.size >= MIN_DISTINCT) return;

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
          // Extensions must be tracked here as well: the prune below asks whether an
          // extension has been covered, and suffixCover is empty past the last string.
          if ((this.requiredPcs.has(pc) || this.requiredAnyOf.includes(pc)) && !covered.has(pc)) {
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

    // Which idiom fits this chord: a ringing open voicing, or a movable grip? The grips
    // exist for chords that have no open shape to fall back on. When the engine's best raw
    // result is an open-position voicing, promoting a barre above it would be a downgrade,
    // so the grips stay where the playability model put them; otherwise they take precedence.
    let bestRaw: [number, Diagram] | null = null;
    for (const entry of scored) if (!bestRaw || entry[0] > bestRaw[0]) bestRaw = entry;
    const applyForms = !bestRaw || !this.fitsOpenPosition(bestRaw[1]);

    // Library grips are injected rather than left to the DFS. A prune that rejects the
    // whole space would otherwise drop the standard shape silently. `seen` is filled at the
    // base case before isValid, so a key missing here means the DFS pruned the diagram,
    // never that it was already scored.
    for (const [key, diagram] of this.formDiagrams) {
      if (seen.has(key)) continue;
      seen.add(key);
      if (!this.isValid(diagram)) continue;
      scored.push([this.score(diagram), [...diagram]]);
    }

    if (applyForms) {
      for (const entry of scored) {
        const weight = this.formWeights.get(diagramToKey(entry[1]));
        if (weight === undefined) continue;
        entry[0] += Math.max(0, weight - this.frettedPosition(entry[1]) * FORM_POSITION_TAPER);
      }
    }

    scored.sort((a, b) => {
      const ka = this.sortKey(a[0], a[1]);
      const kb = this.sortKey(b[0], b[1]);
      for (let i = 0; i < ka.length; i++) {
        const va = ka[i] as number | number[];
        const vb = kb[i] as number | number[];
        if (Array.isArray(va) && Array.isArray(vb)) {
          for (let j = 0; j < va.length; j++) if (va[j] !== vb[j]) return va[j] - vb[j];
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

  private soundingMidi(diagram: Diagram): number[] {
    return this.playedIndices(diagram).map((i) => this.tuning.midi[i] + diagram[i]!);
  }

  private topSoundingIndex(diagram: Diagram): number {
    for (let i = diagram.length - 1; i >= 0; i--) if (diagram[i] !== null) return i;
    return -1;
  }

  // An open-position voicing: everything fretted lies in the first couple of frets and at
  // least one string rings open. These are their own idiom, not something to be displaced.
  private fitsOpenPosition(diagram: Diagram): boolean {
    const positives = diagram.filter((f): f is number => f !== null && f > 0);
    if (!positives.length) return true;
    if (Math.min(...positives) > OPEN_IDIOM_MAX_POSITION) return false;
    return diagram.some((f) => f === 0);
  }

  private frettedPosition(diagram: Diagram): number {
    const positives = diagram.filter((f): f is number => f !== null && f > 0);
    return positives.length ? Math.min(...positives) : 0;
  }

  // A shape resting on three or more open strings rings like an open chord whatever the chord
  // quality: borrow the open voicing curve and range instead of the closed shell model.
  private styleFor(diagram: Diagram): ChordOptions {
    const openCount = diagram.filter((f) => f === 0).length;
    if (openCount < 3) return this.style;
    const openPop = VOICING_STYLES['open_pop'];
    return {
      ...this.style,
      note_curve: openPop.note_curve,
      upper_span_limit: openPop.upper_span_limit,
    };
  }

  private bassIntervalForDiagram(diagram: Diagram): number | null {
    const played = this.playedIndices(diagram);
    if (!played.length) return null;
    const bassPc = this.pcAt(played[0], diagram[played[0]]!);
    return mod12(bassPc - this.chord.rootPc);
  }

  private soundingBassPc(diagram: Diagram): number | null {
    const sounding = this.soundingMidi(diagram);
    if (!sounding.length) return null;
    return mod12(Math.min(...sounding));
  }

  private isSubset(sub: ReadonlySet<number>, sup: ReadonlySet<number>): boolean {
    for (const item of sub) if (!sup.has(item)) return false;
    return true;
  }

  private isValid(diagram: Diagram): boolean {
    const played = this.playedIndices(diagram);
    if (played.length < MIN_NOTES) return false;
    if (this.bassPc !== undefined && this.soundingBassPc(diagram) !== this.bassPc) return false;
    const pcs = this.pcsForDiagram(diagram);
    if (pcs.size < MIN_DISTINCT && this.requiredPcs.size >= MIN_DISTINCT) return false;
    if (!this.isSubset(this.requiredPcs, pcs)) return false;
    if (
      this.enforceExtensions &&
      this.requiredAnyOf.length &&
      !this.requiredAnyOf.some((pc) => pcs.has(pc))
    )
      return false;
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
            diagram[adjIdx] > 0
          );
        });
        if (!ok) return false;
      }
    }
    return true;
  }

  private spanOk(diagram: Diagram): boolean {
    const positives = diagram.filter((f): f is number => f !== null && f > 0);
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

  // One finger can barre a fret as long as nothing lower sits under it. A string fretted
  // below that fret would be stopped by the barre, and an open string would be damped by it,
  // so both split the group; muted strings do not.
  private minFingersRequired(diagram: Diagram): number {
    const fretted: number[] = [];
    for (let i = 0; i < diagram.length; i++) {
      const f = diagram[i];
      if (f !== null && f > 0) fretted.push(i);
    }
    if (!fretted.length) return 0;
    const fretValues = [...new Set(fretted.map((i) => diagram[i]!))].sort((a, b) => a - b);
    let fingers = 0;
    for (const fret of fretValues) {
      const strings = fretted.filter((i) => diagram[i] === fret);
      let groups = 1;
      for (let k = 1; k < strings.length; k++) {
        for (let s = strings[k - 1] + 1; s < strings[k]; s++) {
          const v = diagram[s];
          if (v === 0 || (v !== null && v < fret)) {
            groups++;
            break;
          }
        }
      }
      fingers += groups;
    }
    return fingers;
  }

  private score(diagram: Diagram): number {
    const played = this.playedIndices(diagram);
    const pcs = this.pcsForDiagram(diagram);
    const noteCount = played.length;
    const distinct = pcs.size;
    const style = this.styleFor(diagram);
    let score = 0;
    score += style.note_curve[noteCount] ?? style.default_note_penalty;
    score += distinct * 8;

    const bassInterval = this.bassIntervalForDiagram(diagram);
    if (this.bassPc === undefined) {
      if (bassInterval === 0) score += style.root_bias;
      else score -= 150;
    }

    const extensionPcs = new Set(
      this.chord.intervals
        .filter((iv) => EXTENSION_INTERVALS.includes(iv))
        .map((iv) => mod12(this.chord.rootPc + iv)),
    );
    const hi = diagram.length - 1;
    const hiPrev = diagram.length - 2;
    if (extensionPcs.size && diagram.length >= 2) {
      // Reward actually voicing a tension on top rather than merely muting the top string.
      const top = this.topSoundingIndex(diagram);
      if (top >= 0 && extensionPcs.has(this.pcAt(top, diagram[top]!))) score += 40;
    }

    for (let i = 0; i < diagram.length - 1; i++) {
      if (diagram[i] !== null && diagram[i]! > 0) {
        for (let j = i + 1; j < Math.min(i + 3, diagram.length); j++) {
          if (diagram[j] !== null && diagram[j]! > 0 && diagram[i]! > diagram[j]! + 3) {
            score -= (diagram[i]! - diagram[j]!) * 50;
          }
        }
      }
    }

    const positives = diagram.filter((f): f is number => f !== null && f > 0);
    const maxFret = positives.length ? Math.max(...positives) : 0;
    const openCount = diagram.filter((f) => f === 0).length;
    if (maxFret >= style.open_penalty_threshold) score -= openCount * style.open_penalty_per;

    if (diagram.length >= 2 && diagram[hi] !== null && diagram[hiPrev] === null) score -= 40;

    const sounding = this.soundingMidi(diagram);
    if (sounding.length >= 2) {
      const range = Math.max(...sounding) - Math.min(...sounding);
      score -= Math.max(0, range - style.upper_span_limit) * style.upper_span_penalty_per_semitone;
    }
    const position = positives.length ? Math.min(...positives) : 0;
    score -= position * style.position_penalty_per_fret;

    score -= this.minFingersRequired(diagram) * 10;
    return score;
  }

  private sortKey(score: number, diagram: Diagram): unknown[] {
    const played = this.playedIndices(diagram);
    const positives = diagram.filter((f): f is number => f !== null && f > 0);
    const maxF = positives.length ? Math.max(...positives) : 0;
    const minF = positives.length ? Math.min(...positives) : 0;
    const span = maxF ? maxF - minF : 0;
    return [-score, -played.length, span, maxF, diagram.map((f) => (f === null ? -1 : f))];
  }
}

export function searchChord(tuning: ParsedTuning, chord: ParsedChord): VoicingShape[] {
  let ranked = new BiomechanicalEngine(tuning, chord, true, true).generate(RESULTS_PER_CHORD);
  if (!ranked.length) {
    ranked = new BiomechanicalEngine(tuning, chord, true, false).generate(RESULTS_PER_CHORD);
  }
  if (!ranked.length && chord.bassPc !== undefined) {
    ranked = new BiomechanicalEngine(tuning, chord, false, false).generate(RESULTS_PER_CHORD);
  }
  return ranked.map(([score, diagram]) => makeShape(diagram.slice(), tuning, chord, score));
}
