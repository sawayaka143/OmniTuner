export type AccidentalPreference = 'sharp' | 'flat';
export type ScaleFretCount = 12 | 15 | 21;
export type LabelMode = 'note-names' | 'scale-degrees';

export type SixStringMidiNotes = readonly [number, number, number, number, number, number];

export interface TuningPreset {
  readonly id: string;
  readonly name: string;
  /** Six MIDI notes ordered from the lowest string to the highest string. */
  readonly notes: SixStringMidiNotes;
}

export interface SavedTuning {
  readonly id: string;
  readonly name: string;
  /** Six MIDI notes ordered from the lowest string to the highest string. */
  readonly notes: SixStringMidiNotes;
}

export type TuningSelection =
  | { readonly kind: 'preset'; readonly id: string }
  | { readonly kind: 'custom'; readonly id: string };

export interface ScalePreferencesState {
  readonly rootPitchClass: number;
  readonly scaleId: string;
  readonly accidental: AccidentalPreference;
  readonly fretCount: ScaleFretCount;
  readonly labelMode: LabelMode;
  readonly showOutsideScale: boolean;
  readonly selectedTuning: TuningSelection;
  readonly savedTunings: readonly SavedTuning[];
  readonly accent: string;
  readonly rootNoteColor: string;
  readonly noteColor: string;
  readonly workbenchScale: number;
}
