import { computed, inject, InjectionToken, signal, Service } from '@angular/core';
import { SCALES } from '../data/scale.constants';
import {
  DEFAULT_SCALE_PREFERENCES,
  MAX_TUNING_MIDI_NOTE,
  MIN_TUNING_MIDI_NOTE,
  SCALE_TUNING_PRESETS,
} from '../data/scale-tuning.constants';
import {
  AccidentalPreference,
  LabelMode,
  SavedTuning,
  ScaleFretCount,
  ScalePreferencesState,
  SixStringMidiNotes,
  TuningSelection,
} from '../models/scale-preferences.model';

export const SCALE_PREFERENCES_STORAGE_KEY = 'omnituner.scales.v1';

export const SCALE_PREFERENCES_STORAGE = new InjectionToken<Storage | null>(
  'Scale preferences storage',
  {
    factory: () => {
      try {
        return globalThis.localStorage;
      } catch {
        return null;
      }
    },
  },
);

interface PersistedScalePreferences {
  readonly version: 1;
  readonly state: ScalePreferencesState;
}

const FRET_COUNTS: readonly ScaleFretCount[] = [12, 15, 21];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const WORKBENCH_SCALE_MIN = 0.75;
const WORKBENCH_SCALE_MAX = 1.30;
const WORKBENCH_SCALE_STEP = 0.05;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMidiNote = (value: unknown): value is number =>
  Number.isInteger(value) &&
  typeof value === 'number' &&
  value >= MIN_TUNING_MIDI_NOTE &&
  value <= MAX_TUNING_MIDI_NOTE;

const toSixStringNotes = (value: unknown): SixStringMidiNotes | null => {
  if (!Array.isArray(value) || value.length !== 6 || !value.every(isMidiNote)) return null;
  return [value[0], value[1], value[2], value[3], value[4], value[5]];
};

const readSavedTunings = (value: unknown): readonly SavedTuning[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || typeof entry['name'] !== 'string') {
      return [];
    }
    const notes = toSixStringNotes(entry['notes']);
    const name = entry['name'].trim();
    if (!notes || !name) return [];
    return [{ id: entry['id'], name, notes }];
  });
};

const readSelection = (
  value: unknown,
  savedTunings: readonly SavedTuning[],
): TuningSelection => {
  if (!isRecord(value) || typeof value['id'] !== 'string') {
    return DEFAULT_SCALE_PREFERENCES.selectedTuning;
  }
  if (value['kind'] === 'preset' && SCALE_TUNING_PRESETS.some((preset) => preset.id === value['id'])) {
    return { kind: 'preset', id: value['id'] };
  }
  if (value['kind'] === 'custom' && savedTunings.some((tuning) => tuning.id === value['id'])) {
    return { kind: 'custom', id: value['id'] };
  }
  return DEFAULT_SCALE_PREFERENCES.selectedTuning;
};

const parseState = (value: unknown): ScalePreferencesState | null => {
  if (!isRecord(value) || value['version'] !== 1 || !isRecord(value['state'])) return null;

  const state = value['state'];
  const savedTunings = readSavedTunings(state['savedTunings']);
  const rootPitchClass = state['rootPitchClass'];
  const scaleId = state['scaleId'];
  const accidental = state['accidental'];
  const fretCount = state['fretCount'];
  const accent = state['accent'];
  const rootNoteColor = state['rootNoteColor'];
  const noteColor = state['noteColor'];

  return {
    rootPitchClass:
      typeof rootPitchClass === 'number' && Number.isInteger(rootPitchClass) && rootPitchClass >= 0 && rootPitchClass <= 11
        ? rootPitchClass
        : DEFAULT_SCALE_PREFERENCES.rootPitchClass,
    scaleId:
      typeof scaleId === 'string' && SCALES.some((scale) => scale.id === scaleId)
        ? scaleId
        : DEFAULT_SCALE_PREFERENCES.scaleId,
    accidental: accidental === 'flat' || accidental === 'sharp'
      ? accidental
      : DEFAULT_SCALE_PREFERENCES.accidental,
    fretCount: FRET_COUNTS.includes(fretCount as ScaleFretCount)
      ? (fretCount as ScaleFretCount)
      : DEFAULT_SCALE_PREFERENCES.fretCount,
    labelMode:
      state['labelMode'] === 'note-names' || state['labelMode'] === 'scale-degrees'
        ? (state['labelMode'] as LabelMode)
        : DEFAULT_SCALE_PREFERENCES.labelMode,
    showOutsideScale:
      typeof state['showOutsideScale'] === 'boolean'
        ? state['showOutsideScale']
        : DEFAULT_SCALE_PREFERENCES.showOutsideScale,
    selectedTuning: readSelection(state['selectedTuning'], savedTunings),
    savedTunings,
    accent: typeof accent === 'string' && HEX_COLOR.test(accent)
      ? accent.toLowerCase()
      : DEFAULT_SCALE_PREFERENCES.accent,
    rootNoteColor: typeof rootNoteColor === 'string' && HEX_COLOR.test(rootNoteColor)
      ? rootNoteColor.toLowerCase()
      : DEFAULT_SCALE_PREFERENCES.rootNoteColor,
    noteColor: typeof noteColor === 'string' && HEX_COLOR.test(noteColor)
      ? noteColor.toLowerCase()
      : DEFAULT_SCALE_PREFERENCES.noteColor,
    workbenchScale:
      typeof state['workbenchScale'] === 'number' && isFinite(state['workbenchScale'])
        ? Math.min(Math.max(state['workbenchScale'], WORKBENCH_SCALE_MIN), WORKBENCH_SCALE_MAX)
        : DEFAULT_SCALE_PREFERENCES.workbenchScale,
  };
};

@Service()
export class ScalePreferences {
  private readonly storage = inject(SCALE_PREFERENCES_STORAGE);
  private readonly stateSignal = signal(this.load());

  readonly state = this.stateSignal.asReadonly();
  readonly selectedTuning = computed(() => {
    const state = this.stateSignal();
    const selection = state.selectedTuning;
    return selection.kind === 'preset'
      ? SCALE_TUNING_PRESETS.find((preset) => preset.id === selection.id) ?? SCALE_TUNING_PRESETS[0]
      : state.savedTunings.find((tuning) => tuning.id === selection.id) ?? SCALE_TUNING_PRESETS[0];
  });

  setRootPitchClass(rootPitchClass: number): void {
    if (!Number.isInteger(rootPitchClass) || rootPitchClass < 0 || rootPitchClass > 11) return;
    this.update({ rootPitchClass });
  }

  setScaleId(scaleId: string): void {
    if (!SCALES.some((scale) => scale.id === scaleId)) return;
    this.update({ scaleId });
  }

  setAccidental(accidental: AccidentalPreference): void {
    this.update({ accidental });
  }

  setFretCount(fretCount: ScaleFretCount): void {
    this.update({ fretCount });
  }

  setLabelMode(labelMode: LabelMode): void {
    if (labelMode !== 'note-names' && labelMode !== 'scale-degrees') return;
    this.update({ labelMode });
  }

  setShowOutsideScale(showOutsideScale: boolean): void {
    this.update({ showOutsideScale });
  }

  setAccent(accent: string): void {
    if (!HEX_COLOR.test(accent)) return;
    this.update({ accent: accent.toLowerCase() });
  }

  setRootNoteColor(rootNoteColor: string): void {
    if (!HEX_COLOR.test(rootNoteColor)) return;
    this.update({ rootNoteColor: rootNoteColor.toLowerCase() });
  }

  setNoteColor(noteColor: string): void {
    if (!HEX_COLOR.test(noteColor)) return;
    this.update({ noteColor: noteColor.toLowerCase() });
  }

  setWorkbenchScale(scale: number): void {
    if (!isFinite(scale) || scale < WORKBENCH_SCALE_MIN || scale > WORKBENCH_SCALE_MAX) return;
    const snapped = Math.round(scale / WORKBENCH_SCALE_STEP) * WORKBENCH_SCALE_STEP;
    this.update({ workbenchScale: snapped });
  }

  resetWorkbenchScale(): void {
    this.update({ workbenchScale: 1 });
  }

  selectTuning(selection: TuningSelection): void {
    const exists = selection.kind === 'preset'
      ? SCALE_TUNING_PRESETS.some((preset) => preset.id === selection.id)
      : this.stateSignal().savedTunings.some((tuning) => tuning.id === selection.id);
    if (exists) this.update({ selectedTuning: selection });
  }

  saveTuning(name: string, notes: SixStringMidiNotes): SavedTuning {
    const state = this.stateSignal();
    const tuning: SavedTuning = {
      id: this.createTuningId(),
      ...this.validateTuning(name, notes, state.savedTunings.length + 1),
    };
    this.update({
      savedTunings: [...state.savedTunings, tuning],
      selectedTuning: { kind: 'custom', id: tuning.id },
    });
    return tuning;
  }

  updateTuning(id: string, name: string, notes: SixStringMidiNotes): SavedTuning | null {
    const state = this.stateSignal();
    const index = state.savedTunings.findIndex((tuning) => tuning.id === id);
    if (index === -1) return null;

    const tuning: SavedTuning = {
      id,
      ...this.validateTuning(name, notes, state.savedTunings.length + 1),
    };
    const savedTunings = [...state.savedTunings];
    savedTunings[index] = tuning;
    this.update({
      savedTunings,
      selectedTuning: { kind: 'custom', id },
    });
    return tuning;
  }

  deleteTuning(id: string): void {
    const state = this.stateSignal();
    const savedTunings = state.savedTunings.filter((tuning) => tuning.id !== id);
    if (savedTunings.length === state.savedTunings.length) return;

    const selectedTuning =
      state.selectedTuning.kind === 'custom' && state.selectedTuning.id === id
        ? DEFAULT_SCALE_PREFERENCES.selectedTuning
        : state.selectedTuning;
    this.update({ savedTunings, selectedTuning });
  }

  private update(changes: Partial<ScalePreferencesState>): void {
    this.stateSignal.update((state) => ({ ...state, ...changes }));
    this.persist();
  }

  private load(): ScalePreferencesState {
    if (!this.storage) return DEFAULT_SCALE_PREFERENCES;
    try {
      const raw = this.storage.getItem(SCALE_PREFERENCES_STORAGE_KEY);
      return raw ? parseState(JSON.parse(raw) as unknown) ?? DEFAULT_SCALE_PREFERENCES : DEFAULT_SCALE_PREFERENCES;
    } catch {
      return DEFAULT_SCALE_PREFERENCES;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const persisted: PersistedScalePreferences = { version: 1, state: this.stateSignal() };
    try {
      this.storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Storage can be unavailable or full; current-session state remains usable.
    }
  }

  private validateTuning(
    name: string,
    notes: SixStringMidiNotes,
    fallbackNumber: number,
  ): Pick<SavedTuning, 'name' | 'notes'> {
    const validatedNotes = toSixStringNotes(notes);
    if (!validatedNotes) {
      throw new RangeError(`Tuning notes must be integers from ${MIN_TUNING_MIDI_NOTE} to ${MAX_TUNING_MIDI_NOTE}.`);
    }
    return {
      name: name.trim() || `Custom ${fallbackNumber}`,
      notes: validatedNotes,
    };
  }

  private createTuningId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
