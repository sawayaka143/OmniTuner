export interface IntervalEntry {
  readonly semitones: number;

  readonly label: string;
}

export interface Scale {
  readonly id: string;
  readonly label: string;
  readonly aka?: string;
  readonly group?: string;
  readonly intervals: readonly IntervalEntry[];
}

export interface FretCell {
  readonly stringIndex: number;

  readonly fret: number;

  readonly pitchClass: number;

  readonly midi: number | null;

  readonly interval: IntervalEntry | null;

  readonly noteName: string;

  readonly color: string;

  readonly isRoot: boolean;
}

export interface ScaleTone {
  readonly pitchClass: number;
  readonly midi: number;
  readonly noteName: string;
  readonly interval: IntervalEntry;
  readonly color: string;
  readonly isRoot: boolean;
}
