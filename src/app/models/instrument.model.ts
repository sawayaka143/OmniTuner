export interface TuningString {
  readonly name: string;
  readonly freq: number;
}

export interface Tuning {
  readonly id: string;
  readonly label: string;
  readonly strings: readonly TuningString[];
  readonly kind?: 'custom';
}

export interface Instrument {
  readonly id: string;
  readonly label: string;
  readonly stringCount: number;
  readonly tunings: readonly Tuning[];
  readonly kind?: 'custom';
}
