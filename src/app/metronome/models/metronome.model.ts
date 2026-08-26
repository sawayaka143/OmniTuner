export const BPM_MIN = 1;
export const BPM_MAX = 800;
export const BPM_DEFAULT = 100;

export const NUMERATOR_MIN = 1;
export const NUMERATOR_MAX = 32;
export const DENOMINATORS = [2, 4, 8, 16] as const;
export type Denominator = (typeof DENOMINATORS)[number];

export const DIVISIONS_MIN = 1;
export const DIVISIONS_MAX = 12;

export interface SubdivisionOption {
  readonly n: number;
  readonly label: string;
  readonly shortLabel: string;
}

export const SUBDIVISIONS: readonly SubdivisionOption[] = [
  { n: 1, label: 'Beat only', shortLabel: 'beat' },
  { n: 2, label: 'Eighths', shortLabel: '8ths' },
  { n: 3, label: 'Triplets', shortLabel: 'trips' },
  { n: 4, label: 'Sixteenths', shortLabel: '16ths' },
  { n: 5, label: 'Quintuplets', shortLabel: 'quint' },
  { n: 6, label: 'Sextuplets', shortLabel: 'sext' },
  { n: 7, label: 'Septuplets', shortLabel: 'sept' },
];

export const PATTERN_MIN_BARS = 1;
export const PATTERN_MAX_BARS = 16;

export const POLY_MIN = 1;
export const POLY_MAX = 32;

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 1;

export type SoundId = string;

export type AccentKind = 'downbeat' | 'beat' | 'subdivision' | 'poly';

export interface TimeSignature {
  readonly numerator: number;
  readonly denominator: Denominator;
}

export interface PolyState {
  readonly enabled: boolean;
  readonly events: number;
  readonly accentFirst: boolean;
}

export interface AccentGains {
  readonly downbeat: number;
  readonly beat: number;
  readonly subdivision: number;
  readonly poly: number;
}

export interface MetronomeSoundRoles {
  readonly downbeat: { id: string; vol: number };
  readonly beat: { id: string; vol: number };
  readonly subdivision: { id: string; vol: number };
  readonly poly: { id: string; vol: number; accentVol: number };
}

export interface MetronomeState {
  readonly bpm: number;
  readonly timeSignature: TimeSignature;
  readonly divisionsPerBeat: number;
  readonly barPattern: readonly number[];
  readonly poly: PolyState;
  readonly sounds: MetronomeSoundRoles;
  readonly masterVol: number;
}

export const DEFAULT_METRONOME_SOUNDS: MetronomeSoundRoles = {
  downbeat: { id: 'beep-hi', vol: 1 },
  beat: { id: 'beep-mid', vol: 0.8 },
  subdivision: { id: 'beep-lo', vol: 0.5 },
  poly: { id: 'shaker', vol: 0.55, accentVol: 1 },
};

export const DEFAULT_METRONOME_STATE: MetronomeState = {
  bpm: BPM_DEFAULT,
  timeSignature: { numerator: 4, denominator: 4 },
  divisionsPerBeat: 1,
  barPattern: [1],
  poly: { enabled: false, events: 3, accentFirst: true },
  sounds: DEFAULT_METRONOME_SOUNDS,
  masterVol: 0.9,
};

export const METER_PRESETS: readonly TimeSignature[] = [
  { numerator: 2, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 4, denominator: 4 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 7, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 10, denominator: 16 },
  { numerator: 11, denominator: 8 },
  { numerator: 12, denominator: 8 },
];

export const PATTERN_PRESETS: readonly { readonly label: string; readonly bars: readonly number[] }[] = [
  { label: 'All on', bars: [1] },
  { label: '1 : 1', bars: [1, 0] },
  { label: '2 : 1', bars: [1, 1, 0] },
  { label: '2 : 2', bars: [1, 1, 0, 0] },
  { label: '3 : 1', bars: [1, 1, 1, 0] },
  { label: '4 : 4', bars: [1, 1, 1, 1, 0, 0, 0, 0] },
];

export const POLY_PRESETS: readonly (readonly [number, number])[] = [
  [2, 3],
  [3, 4],
  [4, 3],
  [3, 5],
  [4, 5],
  [5, 4],
  [5, 7],
  [7, 5],
  [9, 7],
] as const;
