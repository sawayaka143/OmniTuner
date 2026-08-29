import { ScalePreferencesState } from '../models/scale-preferences.model';

export const MIN_TUNING_MIDI_NOTE = 24;
export const MAX_TUNING_MIDI_NOTE = 84;

export const DEFAULT_SCALE_PREFERENCES: ScalePreferencesState = {
  rootPitchClass: 4,
  scaleId: 'major',
  accidental: 'sharp',
  fretCount: 12,
  labelMode: 'note-names',
  showOutsideScale: false,
  accent: '#ede8d0',
  rootNoteColor: '#ede8d0',
  noteColor: '#3b3b3b',
  bgColor: null,
  cardColor: null,
  workbenchScale: 1,
  chordRandomProgression: true,
};
