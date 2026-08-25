import { inject, InjectionToken, signal, Service } from '@angular/core';
import { SCALES } from '../data/scale.constants';
import { DEFAULT_SCALE_PREFERENCES } from '../data/scale-tuning.constants';
import {
  AccidentalPreference,
  LabelMode,
  ScaleFretCount,
  ScalePreferencesState,
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
const WORKBENCH_SCALE_MAX = 1.3;
const WORKBENCH_SCALE_STEP = 0.05;
const WORKBENCH_SCALE_STEPS_PER_UNIT = 1 / WORKBENCH_SCALE_STEP;
const clampWorkbenchScale = (v: number): number =>
  Math.min(Math.max(v, WORKBENCH_SCALE_MIN), WORKBENCH_SCALE_MAX);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Color values shipped before the warm cream palette. Installs that never
 * customized colors still carry them in storage; stale defaults are swapped
 * for the current ones on load so palette changes reach existing users.
 * Genuine custom choices pass through untouched.
 */
const LEGACY_COLOR_DEFAULTS = {
  accent: '#ffffff',
  rootNoteColor: '#ffffff',
  noteColor: '#2e2e28',
};

const upgradeLegacyColors = (state: ScalePreferencesState): ScalePreferencesState => ({
  ...state,
  accent:
    state.accent === LEGACY_COLOR_DEFAULTS.accent
      ? DEFAULT_SCALE_PREFERENCES.accent
      : state.accent,
  rootNoteColor:
    state.rootNoteColor === LEGACY_COLOR_DEFAULTS.rootNoteColor
      ? DEFAULT_SCALE_PREFERENCES.rootNoteColor
      : state.rootNoteColor,
  noteColor:
    state.noteColor === LEGACY_COLOR_DEFAULTS.noteColor
      ? DEFAULT_SCALE_PREFERENCES.noteColor
      : state.noteColor,
});

const parseState = (value: unknown): ScalePreferencesState | null => {
  if (!isRecord(value) || value['version'] !== 1 || !isRecord(value['state'])) return null;

  const state = value['state'];
  const rootPitchClass = state['rootPitchClass'];
  const scaleId = state['scaleId'];
  const accidental = state['accidental'];
  const fretCount = state['fretCount'];
  const accent = state['accent'];
  const rootNoteColor = state['rootNoteColor'];
  const noteColor = state['noteColor'];

  return {
    rootPitchClass:
      typeof rootPitchClass === 'number' &&
      Number.isInteger(rootPitchClass) &&
      rootPitchClass >= 0 &&
      rootPitchClass <= 11
        ? rootPitchClass
        : DEFAULT_SCALE_PREFERENCES.rootPitchClass,
    scaleId:
      typeof scaleId === 'string' && SCALES.some((scale) => scale.id === scaleId)
        ? scaleId
        : DEFAULT_SCALE_PREFERENCES.scaleId,
    accidental:
      accidental === 'flat' || accidental === 'sharp'
        ? accidental
        : DEFAULT_SCALE_PREFERENCES.accidental,
    fretCount: FRET_COUNTS.includes(fretCount as ScaleFretCount)
      ? (fretCount as ScaleFretCount)
      : DEFAULT_SCALE_PREFERENCES.fretCount,
    labelMode:
      state['labelMode'] === 'note-names' || state['labelMode'] === 'scale-degrees'
        ? state['labelMode']
        : DEFAULT_SCALE_PREFERENCES.labelMode,
    showOutsideScale:
      typeof state['showOutsideScale'] === 'boolean'
        ? state['showOutsideScale']
        : DEFAULT_SCALE_PREFERENCES.showOutsideScale,
    accent:
      typeof accent === 'string' && HEX_COLOR.test(accent)
        ? accent.toLowerCase()
        : DEFAULT_SCALE_PREFERENCES.accent,
    rootNoteColor:
      typeof rootNoteColor === 'string' && HEX_COLOR.test(rootNoteColor)
        ? rootNoteColor.toLowerCase()
        : DEFAULT_SCALE_PREFERENCES.rootNoteColor,
    noteColor:
      typeof noteColor === 'string' && HEX_COLOR.test(noteColor)
        ? noteColor.toLowerCase()
        : DEFAULT_SCALE_PREFERENCES.noteColor,
    chordRandomProgression:
      typeof state['chordRandomProgression'] === 'boolean'
        ? state['chordRandomProgression']
        : DEFAULT_SCALE_PREFERENCES.chordRandomProgression,
    workbenchScale:
      typeof state['workbenchScale'] === 'number' && Number.isFinite(state['workbenchScale'])
        ? clampWorkbenchScale(state['workbenchScale'])
        : DEFAULT_SCALE_PREFERENCES.workbenchScale,
  };
};

@Service()
export class ScalePreferences {
  private readonly storage = inject(SCALE_PREFERENCES_STORAGE);
  private readonly stateSignal = signal(this.load());

  readonly state = this.stateSignal.asReadonly();

  setRootPitchClass(rootPitchClass: number): void {
    if (!Number.isInteger(rootPitchClass) || rootPitchClass < 0 || rootPitchClass > 11) return;
    this.update({ rootPitchClass });
  }

  setScaleId(scaleId: string): void {
    if (!scaleId || !SCALES.some((scale) => scale.id === scaleId)) return;
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
    if (!isFinite(scale)) return;
    const snapped =
      Math.round(clampWorkbenchScale(scale) * WORKBENCH_SCALE_STEPS_PER_UNIT) /
      WORKBENCH_SCALE_STEPS_PER_UNIT;
    this.update({ workbenchScale: snapped });
  }

  setChordRandomProgression(chordRandomProgression: boolean): void {
    this.update({ chordRandomProgression });
  }

  resetWorkbenchScale(): void {
    this.update({ workbenchScale: 1 });
  }

  private update(changes: Partial<ScalePreferencesState>): void {
    this.stateSignal.update((state) => ({ ...state, ...changes }));
    this.persist();
  }

  private load(): ScalePreferencesState {
    if (!this.storage) return DEFAULT_SCALE_PREFERENCES;
    try {
      const raw = this.storage.getItem(SCALE_PREFERENCES_STORAGE_KEY);
      if (!raw) return DEFAULT_SCALE_PREFERENCES;
      const parsed = parseState(JSON.parse(raw) as unknown);
      return parsed ? upgradeLegacyColors(parsed) : DEFAULT_SCALE_PREFERENCES;
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
}
