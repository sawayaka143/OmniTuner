export interface TuningString {
  name: string;
  freq: number;
}

export interface Tuning {
  id: string;
  label: string;
  strings: TuningString[];
}

export interface Instrument {
  id: string;
  label: string;
  tunings: Tuning[];
}
