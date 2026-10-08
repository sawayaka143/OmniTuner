import { ScalePreferencesState } from '../models/scale-preferences.model';

export const MIN_TUNING_MIDI_NOTE = 24;
export const MAX_TUNING_MIDI_NOTE = 84;

export const ROOT_NOTE_COLOR = '#9fb6d1';
export const NOTE_COLOR = '#3b3b3b';

export const DEFAULT_SCALE_PREFERENCES: ScalePreferencesState = {
  rootPitchClass: 4,
  scaleId: 'major',
  accidental: 'sharp',
  fretCount: 12,
  labelMode: 'note-names',
  showOutsideScale: false,
  workbenchScale: 1,
  chordRandomProgression: true,
};
