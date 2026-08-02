export const MIN_TUNER_MIDI_NOTE = 35;
export const MAX_TUNER_MIDI_NOTE = 86;
export const MAX_CUSTOM_TUNING_NAME_LENGTH = 40;
export const MAX_CUSTOM_INSTRUMENT_NAME_LENGTH = 30;
export const MIN_STRING_COUNT = 3;
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
  /** Master switch: when OFF the tuner behaves exactly as before — no tint, message, chime, or glow. */
  readonly enabled: boolean;
  /** Confirmation chime on lock. */
  readonly sound: boolean;
  /** Ambient glow / one-shot pulse on lock. */
  readonly glow: boolean;
  /** Single user-configurable color driving every in-tune cue, via --in-tune-color. */
  readonly color: string;
  /** ± cents window for the lock. */
  readonly tolerance: number;
  /** ms the pitch must stay in range before confirming. */
  readonly holdMs: number;
}

export interface TunerSettings {
  readonly mode: TunerMode;
  /** Mode applied on startup: remember the last used mode, or force one. */
  readonly startupMode: TunerStartupMode;
  readonly inTune: InTunePreferences;
  /** A4 reference pitch in Hz (default 440). */
  readonly referencePitch: number;
}

export const DEFAULT_IN_TUNE_PREFERENCES: InTunePreferences = {
  enabled: true,
  sound: true,
  glow: true,
  color: '#7ecba8',
  tolerance: 5,
  holdMs: 500,
};

export const DEFAULT_TUNER_SETTINGS: TunerSettings = {
  mode: 'auto',
  startupMode: 'remember',
  inTune: DEFAULT_IN_TUNE_PREFERENCES,
  referencePitch: REFERENCE_PITCH_DEFAULT,
};
