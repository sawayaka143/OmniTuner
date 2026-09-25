export type AccidentalPreference = 'sharp' | 'flat';
export type ScaleFretCount = 12 | 15 | 21;
export type LabelMode = 'note-names' | 'scale-degrees';

export interface ScalePreferencesState {
  readonly rootPitchClass: number;
  readonly scaleId: string;
  readonly accidental: AccidentalPreference;
  readonly fretCount: ScaleFretCount;
  readonly labelMode: LabelMode;
  readonly showOutsideScale: boolean;
  readonly accent: string;
  readonly rootNoteColor: string;
  readonly noteColor: string;
  readonly bgColorDark: string | null;
  readonly cardColorDark: string | null;
  readonly bgColorLight: string | null;
  readonly cardColorLight: string | null;
  readonly workbenchScale: number;
  readonly chordRandomProgression: boolean;
}
