export const TUNER_INSTRUMENT_IDS = ['guitar', 'ukulele'] as const;

export type TunerInstrumentId = (typeof TUNER_INSTRUMENT_IDS)[number];

export const TUNER_STRING_COUNTS: Readonly<Record<TunerInstrumentId, number>> = {
  guitar: 6,
  ukulele: 4,
};

export const MIN_TUNER_MIDI_NOTE = 35;
export const MAX_TUNER_MIDI_NOTE = 86;
export const MAX_CUSTOM_TUNING_NAME_LENGTH = 40;

export interface SavedCustomTuning {
  readonly id: string;
  readonly instrumentId: TunerInstrumentId;
  readonly name: string;
  readonly notes: readonly number[];
}
