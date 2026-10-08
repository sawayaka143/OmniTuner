import { inject, InjectionToken, signal, Service } from '@angular/core';
import { SCALES } from '../data/scale.constants';
import { DEFAULT_SCALE_PREFERENCES } from '../data/scale-tuning.constants';
import {
  AccidentalPreference,
  LabelMode,
  ScaleFretCount,
  ScalePreferencesState,
} from '../models/scale-preferences.model';

export const SCALE_PREFERENCES_STORAGE_KEY = 'omnituner.scales.v2';
export const LEGACY_SCALE_PREFERENCES_STORAGE_KEY = 'omnituner.scales.v1';

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
  readonly version: 2;
  readonly state: ScalePreferencesState;
}

const FRET_COUNTS: readonly ScaleFretCount[] = [12, 15, 21];
const WORKBENCH_SCALE_MIN = 0.75;
const WORKBENCH_SCALE_MAX = 1.3;
const WORKBENCH_SCALE_STEP = 0.05;
const WORKBENCH_SCALE_STEPS_PER_UNIT = 1 / WORKBENCH_SCALE_STEP;
const clampWorkbenchScale = (v: number): number =>
  Math.min(Math.max(v, WORKBENCH_SCALE_MIN), WORKBENCH_SCALE_MAX);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseState = (value: unknown): ScalePreferencesState | null => {
  if (!isRecord(value) || !isRecord(value['state'])) return null;
  const version = value['version'];
  if (version !== 1 && version !== 2) return null;

  const state = value['state'];
  const rootPitchClass = state['rootPitchClass'];
  const scaleId = state['scaleId'];
  const accidental = state['accidental'];
  const fretCount = state['fretCount'];

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

  setWorkbenchScale(scale: number): void {
    if (!isFinite(scale)) return;
    const snapped =
      Math.round(clampWorkbenchScale(scale) * WORKBENCH_SCALE_STEPS_PER_UNIT) /
      WORKBENCH_SCALE_STEPS_PER_UNIT;
    this.update({ workbenchScale: snapped });
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
      const parsed = raw ? parseState(JSON.parse(raw) as unknown) : this.loadLegacyState();
      return parsed ?? DEFAULT_SCALE_PREFERENCES;
    } catch {
      return DEFAULT_SCALE_PREFERENCES;
    }
  }

  private loadLegacyState(): ScalePreferencesState | null {
    try {
      const legacy = this.storage?.getItem(LEGACY_SCALE_PREFERENCES_STORAGE_KEY);
      return legacy ? parseState(JSON.parse(legacy) as unknown) : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const persisted: PersistedScalePreferences = {
      version: 2,
      state: this.stateSignal(),
    };
    try {
      this.storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify(persisted));
    } catch {}
  }
}
