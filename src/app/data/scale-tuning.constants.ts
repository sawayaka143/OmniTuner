import { ScalePreferencesState, TuningPreset } from '../models/scale-preferences.model';

export const MIN_TUNING_MIDI_NOTE = 24;
export const MAX_TUNING_MIDI_NOTE = 84;

export const SCALE_TUNING_PRESETS: readonly TuningPreset[] = [
  { id: 'standard', name: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  { id: 'half-step-down', name: 'Half-step down', notes: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', name: 'DADGAD', notes: [38, 45, 50, 57, 59, 62] },
  { id: 'open-g', name: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
  { id: 'drop-c', name: 'Drop C', notes: [36, 43, 48, 55, 57, 62] },
];

export const DEFAULT_SCALE_PREFERENCES: ScalePreferencesState = {
  rootPitchClass: 4,
  scaleId: 'major',
  accidental: 'sharp',
  fretCount: 12,
  labelMode: 'note-names',
  showOutsideScale: false,
  selectedTuning: { kind: 'preset', id: 'standard' },
  savedTunings: [],
  accent: '#779900',
  rootNoteColor: '#ffffff',
  noteColor: '#2e2e28',
  workbenchScale: 1,
};
