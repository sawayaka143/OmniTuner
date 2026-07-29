export interface TuningString {
  readonly name: string;
  readonly freq: number;
}

export interface Tuning {
  readonly id: string;
  readonly label: string;
  readonly strings: TuningString[];
  readonly kind?: 'custom';
}

export interface Instrument {
  readonly id: string;
  readonly label: string;
  readonly tunings: Tuning[];
}
