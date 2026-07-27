/**
 * A single interval relative to a root note.
 *
 * `semitones` is the raw pitch offset from the root and is used for placement
 * math. `label` is the **source of truth** for both display and coloring, because
 * a semitone value is ambiguous — e.g. semitone 2 is a "9th" in a dominant 9
 * chord but a "sus2" in a sus2 chord. The label disambiguates.
 */
export interface IntervalEntry {
  /** Offset from the root, in semitones. May exceed 11 (e.g. a 9th = 14). */
  readonly semitones: number;
  /** Display + color key, e.g. 'R', 'b3', '5', '9', 'sus2'. */
  readonly label: string;
}

/** A named scale or mode, defined as a list of labelled intervals. */
export interface Scale {
  readonly id: string;
  readonly label: string;
  readonly intervals: readonly IntervalEntry[];
}

/**
 * One renderable fret position. Display-ready: every value the UI needs is
 * pre-computed so the template stays free of business logic.
 *
 * `interval` is `null` when the pitch at this cell is not part of the current
 * scale (no dot is drawn).
 */
export interface FretCell {
  /** String index, 0 = highest-pitched string (top of the visual board). */
  readonly stringIndex: number;
  /** Fret number, 0 = open string. */
  readonly fret: number;
  /** Absolute pitch class 0–11 (C = 0). */
  readonly pitchClass: number;
  /** Resolved interval for this cell, or `null` if not in the current scale. */
  readonly interval: IntervalEntry | null;
  /** Enharmonic-correct display name (e.g. 'Eb' vs 'D#'). */
  readonly noteName: string;
  /** Color resolved from the interval label via `colorForLabel`. */
  readonly color: string;
  /** True when this cell is the root note. */
  readonly isRoot: boolean;
}
