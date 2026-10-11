import { CHORD_FORMS, ChordForm } from '../data/chord-forms';
import { DEFAULT_VOICING_COUNT } from '../data/chord-voicing.constants';
import { ParsedChord, ParsedTuning } from './chord-theory';

export const MAX_FRET = 12;

const MAX_SPAN = 4;
const MAX_THUMB_REACH = 4;
const MAX_FINGERS = 4;
const MIN_NOTES = 3;
const MIN_DISTINCT = 3;
const OPEN_STRING_MAX_FRET = 3;
const FIRST_POSITION_MAX_FRET = 4;
const COMFORTABLE_SPAN = 2;
const COMFORTABLE_RANGE = 24;
const REVERSE_STRETCH_FRETS = 3;

const WEIGHTS = {
  rootInBass: 100,
  otherBass: -150,
  perNote: 14,
  perDistinctPc: 8,
  perFinger: -8,
  perBarre: -55,
  perPositionFret: -6,
  perInteriorMute: -30,
  perOutOfPositionOpen: -30,
  perSpanFretBeyondComfort: -15,
  perSemitoneBeyondRange: -2,
  perReverseStretchFret: -50,
  extensionOnTop: 10,
  standardGrip: 45,
} as const;

export const EXTENSION_INTERVALS: readonly number[] = [13, 14, 15, 17, 18, 20, 21];
const ALTERED_EXTENSION_INTERVALS: readonly number[] = [13, 15, 18, 20];

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

type Frets = readonly (number | null)[];

interface Fingering {
  readonly fingers: number;
  readonly barres: number;
}

interface ShapeFeatures {
  readonly frets: Frets;
  readonly sounding: readonly SoundingNote[];
  readonly pcs: ReadonlySet<number>;
  readonly bassMidi: number;
  readonly topPc: number;
  readonly range: number;
  readonly position: number;
  readonly maxFret: number;
  readonly span: number;
  readonly openCount: number;
  readonly interiorMutes: number;
  readonly fingering: Fingering;
}

interface RankedShape {
  readonly features: ShapeFeatures;
  readonly score: number;
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

const fretsKey = (frets: Frets): string => frets.map((f) => (f === null ? 'x' : f)).join(',');

export function instantiateForm(
  form: ChordForm,
  tuning: ParsedTuning,
  rootPc: number,
): (number | null)[] | null {
  if (form.offsets.length !== tuning.midi.length) return null;
  const anchorFret = mod12(rootPc - tuning.midi[form.anchor]);
  const frets: (number | null)[] = [];
  for (const offset of form.offsets) {
    if (offset === null) {
      frets.push(null);
      continue;
    }
    const fret = anchorFret + offset;
    if (fret < 0 || fret > MAX_FRET) return null;
    frets.push(fret);
  }
  return frets;
}

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

export function requiredExtensions(chord: ParsedChord): readonly number[] {
  const extensions = chord.intervals.filter((interval) => EXTENSION_INTERVALS.includes(interval));
  if (!extensions.length) return [];
  const highest = Math.max(...extensions);
  return chord.pcs.filter((_, index) => {
    const interval = chord.intervals[index];
    return interval === highest || ALTERED_EXTENSION_INTERVALS.includes(interval);
  });
}

export function isNarrowingOf(narrow: Frets, wide: Frets): boolean {
  return narrow.every((fret, i) => fret === null || fret === wide[i]);
}

export function analyseFingering(frets: Frets): Fingering | null {
  const fretted: number[] = [];
  frets.forEach((fret, i) => {
    if (fret !== null && fret > 0) fretted.push(i);
  });
  if (fretted.length <= MAX_FINGERS) return { fingers: fretted.length, barres: 0 };

  const groupSizes: number[] = [];
  for (const fret of new Set(fretted.map((i) => frets[i]!))) {
    const strings = fretted.filter((i) => frets[i] === fret);
    let size = 1;
    for (let k = 1; k < strings.length; k++) {
      let blocked = false;
      for (let s = strings[k - 1] + 1; s < strings[k]; s++) {
        const between = frets[s];
        if (between === 0 || (between !== null && between < fret)) blocked = true;
      }
      if (blocked) {
        groupSizes.push(size);
        size = 1;
      } else {
        size++;
      }
    }
    groupSizes.push(size);
  }

  let fingers = fretted.length;
  let barres = 0;
  for (const size of groupSizes.filter((s) => s > 1).sort((a, b) => b - a)) {
    if (fingers <= MAX_FINGERS) break;
    fingers -= size - 1;
    barres++;
  }
  return fingers <= MAX_FINGERS ? { fingers, barres } : null;
}

function describeShape(frets: Frets, tuning: ParsedTuning): ShapeFeatures | null {
  const fingering = analyseFingering(frets);
  if (!fingering) return null;
  const sounding: SoundingNote[] = [];
  frets.forEach((fret, stringIndex) => {
    if (fret !== null) sounding.push({ stringIndex, fret, midi: tuning.midi[stringIndex] + fret });
  });
  const midis = sounding.map((note) => note.midi);
  const pressed = sounding.map((note) => note.fret).filter((fret) => fret > 0);
  const position = pressed.length ? Math.min(...pressed) : 0;
  const maxFret = pressed.length ? Math.max(...pressed) : 0;
  const first = sounding.length ? sounding[0].stringIndex : 0;
  const last = sounding.length ? sounding[sounding.length - 1].stringIndex : 0;
  return {
    frets,
    sounding,
    pcs: new Set(midis.map(mod12)),
    bassMidi: Math.min(...midis),
    topPc: mod12(Math.max(...midis)),
    range: Math.max(...midis) - Math.min(...midis),
    position,
    maxFret,
    span: maxFret - position,
    openCount: sounding.filter((note) => note.fret === 0).length,
    interiorMutes: last - first + 1 - sounding.length,
    fingering,
  };
}

function compareRanked(a: RankedShape, b: RankedShape): number {
  const fa = a.features;
  const fb = b.features;
  if (a.score !== b.score) return b.score - a.score;
  if (fa.sounding.length !== fb.sounding.length) return fb.sounding.length - fa.sounding.length;
  if (fa.span !== fb.span) return fa.span - fb.span;
  if (fa.maxFret !== fb.maxFret) return fa.maxFret - fb.maxFret;
  return fretsKey(fa.frets).localeCompare(fretsKey(fb.frets));
}

class VoicingSearch {
  private readonly chordPcs: ReadonlySet<number>;
  private readonly requiredPcs: ReadonlySet<number>;
  private readonly extensionPcs: ReadonlySet<number>;
  private readonly bassPc: number | undefined;
  private readonly allowedPcs: ReadonlySet<number>;
  private readonly standardGrips: ReadonlySet<string>;
  private readonly hasBassString: boolean;

  constructor(
    private readonly tuning: ParsedTuning,
    private readonly chord: ParsedChord,
    enforceBass: boolean,
    enforceExtensions: boolean,
  ) {
    this.chordPcs = new Set(chord.pcs);
    this.requiredPcs = new Set([
      ...requiredPitchClasses(chord),
      ...(enforceExtensions ? requiredExtensions(chord) : []),
    ]);
    this.extensionPcs = new Set(
      chord.pcs.filter((_, index) => EXTENSION_INTERVALS.includes(chord.intervals[index])),
    );
    this.bassPc = enforceBass ? chord.bassPc : undefined;
    this.allowedPcs =
      this.bassPc === undefined ? this.chordPcs : new Set([...this.chordPcs, this.bassPc]);
    this.hasBassString = tuning.midi[0] === Math.min(...tuning.midi);
    this.standardGrips = new Set(this.gripsForChord().map((frets) => fretsKey(frets)));
  }

  run(count: number): VoicingShape[] {
    const seen = new Set<string>();
    const ranked: RankedShape[] = [];
    const consider = (frets: Frets): void => {
      const key = fretsKey(frets);
      if (seen.has(key)) return;
      seen.add(key);
      const features = describeShape(frets, this.tuning);
      if (!features || !this.isPlayable(features)) return;
      ranked.push({ features, score: this.score(features) });
    };
    this.enumerate(consider);
    for (const grip of this.gripsForChord()) consider(grip);
    ranked.sort(compareRanked);
    return this.pickDistinct(ranked, count).map((entry) => this.toShape(entry));
  }

  private gripsForChord(): (number | null)[][] {
    return CHORD_FORMS.filter((form) => form.qualities.includes(this.chord.quality))
      .map((form) => instantiateForm(form, this.tuning, this.chord.rootPc))
      .filter((frets): frets is (number | null)[] => frets !== null);
  }

  private stringOptions(): (number | null)[][] {
    return this.tuning.midi.map((open) => {
      const options: (number | null)[] = [null];
      for (let fret = 0; fret <= MAX_FRET; fret++) {
        if (this.allowedPcs.has(mod12(open + fret))) options.push(fret);
      }
      return options;
    });
  }

  private enumerate(visit: (frets: Frets) => void): void {
    const options = this.stringOptions();
    const n = options.length;
    const reachable: Set<number>[] = Array.from({ length: n + 1 }, () => new Set<number>());
    for (let s = n - 1; s >= 0; s--) {
      reachable[s] = new Set(reachable[s + 1]);
      for (const fret of options[s]) {
        if (fret !== null) reachable[s].add(mod12(this.tuning.midi[s] + fret));
      }
    }
    const current: (number | null)[] = [];
    const counts = new Map<number, number>();
    const has = (pc: number, idx: number): boolean =>
      (counts.get(pc) ?? 0) > 0 || reachable[idx].has(pc);
    const needsDistinct = this.requiredPcs.size >= MIN_DISTINCT;

    const walk = (idx: number, played: number): void => {
      for (const pc of this.requiredPcs) if (!has(pc, idx)) return;
      if (played + (n - idx) < MIN_NOTES) return;
      if (needsDistinct && this.distinctChordTones(counts) + (n - idx) < MIN_DISTINCT) return;
      if (idx === n) {
        visit([...current]);
        return;
      }
      for (const fret of options[idx]) {
        current.push(fret);
        const pc = fret === null ? null : mod12(this.tuning.midi[idx] + fret);
        if (pc !== null) counts.set(pc, (counts.get(pc) ?? 0) + 1);
        walk(idx + 1, played + (pc === null ? 0 : 1));
        if (pc !== null) counts.set(pc, counts.get(pc)! - 1);
        current.pop();
      }
    };
    walk(0, 0);
  }

  private distinctChordTones(counts: ReadonlyMap<number, number>): number {
    let distinct = 0;
    for (const [pc, count] of counts) if (count > 0 && this.chordPcs.has(pc)) distinct++;
    return distinct;
  }

  private isPlayable(shape: ShapeFeatures): boolean {
    if (shape.sounding.length < MIN_NOTES) return false;
    if (this.bassPc !== undefined && mod12(shape.bassMidi) !== this.bassPc) return false;
    if (shape.pcs.size < MIN_DISTINCT && this.requiredPcs.size >= MIN_DISTINCT) return false;
    for (const pc of this.requiredPcs) if (!shape.pcs.has(pc)) return false;
    return this.mutesReachable(shape.frets) && this.spanReachable(shape);
  }

  private mutesReachable(frets: Frets): boolean {
    const played = frets.flatMap((fret, i) => (fret === null ? [] : [i]));
    if (played.length < 2) return true;
    for (let i = played[0] + 1; i < played[played.length - 1]; i++) {
      if (frets[i] !== null) continue;
      const touched = [frets[i - 1], frets[i + 1]].some(
        (f) => f !== null && f !== undefined && f > 0,
      );
      if (!touched) return false;
    }
    return true;
  }

  private spanReachable(shape: ShapeFeatures): boolean {
    if (shape.span <= MAX_SPAN) return true;
    const thumb = shape.frets[0];
    if (thumb === null || thumb === 0 || shape.frets.length < 4) return false;
    const others = shape.frets.slice(1).filter((f): f is number => f !== null && f > 0);
    if (!others.length) return false;
    const low = Math.min(...others);
    return Math.max(...others) - low <= MAX_SPAN && thumb <= low && low - thumb <= MAX_THUMB_REACH;
  }

  private score(shape: ShapeFeatures): number {
    let score = 0;
    if (this.bassPc === undefined && this.hasBassString) {
      score += mod12(shape.bassMidi) === this.chord.rootPc ? WEIGHTS.rootInBass : WEIGHTS.otherBass;
    }
    score += shape.sounding.length * WEIGHTS.perNote;
    score += shape.pcs.size * WEIGHTS.perDistinctPc;
    score += shape.fingering.fingers * WEIGHTS.perFinger;
    score += shape.fingering.barres * WEIGHTS.perBarre;
    if (shape.maxFret > FIRST_POSITION_MAX_FRET) {
      score += (shape.position - 1) * WEIGHTS.perPositionFret;
    }
    score += shape.interiorMutes * WEIGHTS.perInteriorMute;
    if (shape.maxFret > OPEN_STRING_MAX_FRET) {
      score += shape.openCount * WEIGHTS.perOutOfPositionOpen;
    }
    score += Math.max(0, shape.span - COMFORTABLE_SPAN) * WEIGHTS.perSpanFretBeyondComfort;
    score += Math.max(0, shape.range - COMFORTABLE_RANGE) * WEIGHTS.perSemitoneBeyondRange;
    score += this.reverseStretch(shape.frets) * WEIGHTS.perReverseStretchFret;
    if (this.extensionPcs.has(shape.topPc)) score += WEIGHTS.extensionOnTop;
    if (this.standardGrips.has(fretsKey(shape.frets))) score += WEIGHTS.standardGrip;
    return score;
  }

  private reverseStretch(frets: Frets): number {
    let total = 0;
    for (let i = 0; i < frets.length - 1; i++) {
      const low = frets[i];
      if (low === null || low === 0) continue;
      for (let j = i + 1; j < Math.min(i + 3, frets.length); j++) {
        const high = frets[j];
        if (high !== null && high > 0 && low > high + REVERSE_STRETCH_FRETS) total += low - high;
      }
    }
    return total;
  }

  private pickDistinct(ranked: readonly RankedShape[], count: number): RankedShape[] {
    const picked: RankedShape[] = [];
    for (const entry of ranked) {
      if (picked.length >= count) break;
      const frets = entry.features.frets;
      const duplicate = picked.some(
        (other) =>
          isNarrowingOf(frets, other.features.frets) || isNarrowingOf(other.features.frets, frets),
      );
      if (!duplicate) picked.push(entry);
    }
    return picked;
  }

  private toShape({ features, score }: RankedShape): VoicingShape {
    return {
      frets: features.frets,
      sounding: features.sounding,
      span: features.span,
      bassMidi: features.bassMidi,
      bassIsRoot: mod12(features.bassMidi) === this.chord.rootPc,
      position: features.position,
      openCount: features.openCount,
      cost: score,
    };
  }
}

export function searchChord(
  tuning: ParsedTuning,
  chord: ParsedChord,
  count: number = DEFAULT_VOICING_COUNT,
): VoicingShape[] {
  const attempts: readonly [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, false],
  ];
  for (const [enforceBass, enforceExtensions] of attempts) {
    if (!enforceBass && chord.bassPc === undefined) break;
    const shapes = new VoicingSearch(tuning, chord, enforceBass, enforceExtensions).run(count);
    if (shapes.length) return shapes;
  }
  return [];
}
