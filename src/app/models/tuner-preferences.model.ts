export const MIN_TUNER_MIDI_NOTE = 23;
export const MAX_TUNER_MIDI_NOTE = 86;
export const MAX_CUSTOM_TUNING_NAME_LENGTH = 40;
export const MAX_CUSTOM_INSTRUMENT_NAME_LENGTH = 30;
export const MIN_STRING_COUNT = 1;
export const MAX_STRING_COUNT = 12;

export const REFERENCE_PITCH_MIN = 415;
export const REFERENCE_PITCH_MAX = 466;
export const REFERENCE_PITCH_DEFAULT = 440;

export interface SavedCustomTuning {
  readonly id: string;
  readonly instrumentId: string;
  readonly name: string;
  readonly notes: readonly number[];
}

export type TunerMode = 'auto' | 'manual';

export type TunerStartupMode = 'remember' | TunerMode;

export const TUNER_TOLERANCE_MIN = 1;
export const TUNER_TOLERANCE_MAX = 15;
export const TUNER_HOLD_MIN = 0;
export const TUNER_HOLD_MAX = 1500;
export const TUNER_HOLD_STEP = 50;

export interface InTunePreferences {
  readonly enabled: boolean;

  readonly sound: boolean;

  readonly glow: boolean;

  readonly tolerance: number;

  readonly holdMs: number;
}

export interface TunerSettings {
  readonly mode: TunerMode;

  readonly startupMode: TunerStartupMode;
  readonly autoStart: boolean;
  readonly inTune: InTunePreferences;

  readonly referencePitch: number;
}

export const IN_TUNE_COLOR = '#7ecba8';
export const OUT_OF_TUNE_COLOR = '#ff8aab';

export const DEFAULT_IN_TUNE_PREFERENCES: InTunePreferences = {
  enabled: true,
  sound: true,
  glow: true,
  tolerance: 5,
  holdMs: 500,
};

export const DEFAULT_TUNER_SETTINGS: TunerSettings = {
  mode: 'auto',
  startupMode: 'remember',
  autoStart: true,
  inTune: DEFAULT_IN_TUNE_PREFERENCES,
  referencePitch: REFERENCE_PITCH_DEFAULT,
};
