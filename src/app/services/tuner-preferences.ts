import { inject, InjectionToken, Service, signal } from '@angular/core';
import {
  DEFAULT_TUNER_SETTINGS,
  InTunePreferences,
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
  SavedCustomTuning,
  TUNER_HOLD_MAX,
  TUNER_HOLD_MIN,
  TUNER_STRING_COUNTS,
  TUNER_TOLERANCE_MAX,
  TUNER_TOLERANCE_MIN,
  TunerInstrumentId,
  TunerMode,
  TunerSettings,
  TunerStartupMode,
} from '../models/tuner-preferences.model';

export const TUNER_PREFERENCES_STORAGE_KEY = 'omnituner.tuner-preferences.v1';
export const TUNER_PREFERENCES_VERSION = 2;

export const TUNER_PREFERENCES_STORAGE = new InjectionToken<Storage | null>(
  'Tuner preferences storage',
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

interface PersistedTunerPreferences {
  readonly version: number;
  readonly tunings: readonly SavedCustomTuning[];
  readonly tuner?: TunerSettings;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const isSupportedVersion = (value: unknown): boolean => value === 1 || value === 2;

const isTunerMode = (value: unknown): value is TunerMode => value === 'auto' || value === 'manual';

const isStartupMode = (value: unknown): value is TunerStartupMode =>
  value === 'remember' || isTunerMode(value);

const clampTolerance = (value: number): number =>
  Math.min(TUNER_TOLERANCE_MAX, Math.max(TUNER_TOLERANCE_MIN, Math.round(value)));

const clampHoldMs = (value: number): number =>
  Math.min(TUNER_HOLD_MAX, Math.max(TUNER_HOLD_MIN, Math.round(value)));

const CUSTOM_TUNING_ID = /^custom-[a-z0-9-]+$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isInstrumentId = (value: unknown): value is TunerInstrumentId =>
  value === 'guitar' || value === 'ukulele';

const isMidiNote = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_TUNER_MIDI_NOTE &&
  value <= MAX_TUNER_MIDI_NOTE;

const toMidiNotes = (value: unknown, instrumentId: TunerInstrumentId): readonly number[] | null => {
  if (
    !Array.isArray(value) ||
    value.length !== TUNER_STRING_COUNTS[instrumentId] ||
    !value.every(isMidiNote)
  ) {
    return null;
  }

  return [...value];
};

const readTunings = (value: unknown): readonly SavedCustomTuning[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const tunings: SavedCustomTuning[] = [];

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      !CUSTOM_TUNING_ID.test(entry['id']) ||
      seenIds.has(entry['id']) ||
      !isInstrumentId(entry['instrumentId']) ||
      typeof entry['name'] !== 'string'
    ) {
      continue;
    }

    const name = entry['name'].trim();
    const notes = toMidiNotes(entry['notes'], entry['instrumentId']);
    if (!name || name.length > MAX_CUSTOM_TUNING_NAME_LENGTH || !notes) continue;

    seenIds.add(entry['id']);
    tunings.push({
      id: entry['id'],
      instrumentId: entry['instrumentId'],
      name,
      notes,
    });
  }

  return tunings;
};

const parseTunings = (value: unknown): readonly SavedCustomTuning[] => {
  if (!isRecord(value) || !isSupportedVersion(value['version']) || !('tunings' in value)) {
    return [];
  }

  return readTunings(value['tunings']);
};

const readTunerSettings = (value: unknown): TunerSettings => {
  if (!isRecord(value) || value['version'] !== 2 || !isRecord(value['tuner'])) {
    return DEFAULT_TUNER_SETTINGS;
  }

  const tuner = value['tuner'];
  const rawInTune = isRecord(tuner['inTune']) ? tuner['inTune'] : {};
  const defaults = DEFAULT_TUNER_SETTINGS;

  const color =
    typeof rawInTune['color'] === 'string' && HEX_COLOR.test(rawInTune['color'])
      ? rawInTune['color'].toLowerCase()
      : defaults.inTune.color;
  const tolerance =
    typeof rawInTune['tolerance'] === 'number' && Number.isFinite(rawInTune['tolerance'])
      ? clampTolerance(rawInTune['tolerance'])
      : defaults.inTune.tolerance;
  const holdMs =
    typeof rawInTune['holdMs'] === 'number' && Number.isFinite(rawInTune['holdMs'])
      ? clampHoldMs(rawInTune['holdMs'])
      : defaults.inTune.holdMs;

  return {
    mode: isTunerMode(tuner['mode']) ? tuner['mode'] : defaults.mode,
    startupMode: isStartupMode(tuner['startupMode']) ? tuner['startupMode'] : defaults.startupMode,
    inTune: {
      enabled:
        typeof rawInTune['enabled'] === 'boolean' ? rawInTune['enabled'] : defaults.inTune.enabled,
      sound: typeof rawInTune['sound'] === 'boolean' ? rawInTune['sound'] : defaults.inTune.sound,
      glow: typeof rawInTune['glow'] === 'boolean' ? rawInTune['glow'] : defaults.inTune.glow,
      color,
      tolerance,
      holdMs,
    },
  };
};

interface LoadedTunerPreferences {
  readonly tunings: readonly SavedCustomTuning[];
  readonly tuner: TunerSettings;
}

const DEFAULT_LOADED: LoadedTunerPreferences = {
  tunings: [],
  tuner: DEFAULT_TUNER_SETTINGS,
};

@Service()
export class TunerPreferences {
  private readonly storage = inject(TUNER_PREFERENCES_STORAGE);
  private readonly persisted = this.load();
  private readonly customTuningsSignal = signal<readonly SavedCustomTuning[]>(this.persisted.tunings);
  private readonly tunerSettingsSignal = signal<TunerSettings>(this.persisted.tuner);

  readonly customTunings = this.customTuningsSignal.asReadonly();
  readonly tunerSettings = this.tunerSettingsSignal.asReadonly();

  tuningsForInstrument(instrumentId: string): readonly SavedCustomTuning[] {
    if (!isInstrumentId(instrumentId)) return [];
    return this.customTuningsSignal().filter((tuning) => tuning.instrumentId === instrumentId);
  }

  createTuning(instrumentId: string, name: string, notes: readonly number[]): SavedCustomTuning {
    const validInstrumentId = this.requireInstrumentId(instrumentId);
    const tuning: SavedCustomTuning = {
      id: this.createTuningId(),
      instrumentId: validInstrumentId,
      name: this.requireName(name),
      notes: this.requireNotes(notes, validInstrumentId),
    };

    this.commit([...this.customTuningsSignal(), tuning]);
    return tuning;
  }

  updateTuning(id: string, name: string, notes: readonly number[]): SavedCustomTuning {
    const tunings = this.customTuningsSignal();
    const index = tunings.findIndex((tuning) => tuning.id === id);
    if (index === -1) throw new RangeError('Custom tuning does not exist.');

    const existing = tunings[index];
    const updated: SavedCustomTuning = {
      ...existing,
      name: this.requireName(name),
      notes: this.requireNotes(notes, existing.instrumentId),
    };
    const next = [...tunings];
    next[index] = updated;
    this.commit(next);
    return updated;
  }

  deleteTuning(id: string): void {
    const tunings = this.customTuningsSignal();
    const next = tunings.filter((tuning) => tuning.id !== id);
    if (next.length !== tunings.length) this.commit(next);
  }

  private requireInstrumentId(instrumentId: string): TunerInstrumentId {
    if (!isInstrumentId(instrumentId)) {
      throw new RangeError('Custom tunings are only supported for guitar and ukulele.');
    }
    return instrumentId;
  }

  private requireName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new RangeError('A custom tuning name is required.');
    if (normalized.length > MAX_CUSTOM_TUNING_NAME_LENGTH) {
      throw new RangeError(
        `Custom tuning names must be ${MAX_CUSTOM_TUNING_NAME_LENGTH} characters or fewer.`,
      );
    }
    return normalized;
  }

  private requireNotes(
    notes: readonly number[],
    instrumentId: TunerInstrumentId,
  ): readonly number[] {
    const validNotes = toMidiNotes(notes, instrumentId);
    if (!validNotes) {
      throw new RangeError(
        `${instrumentId} tunings require ${TUNER_STRING_COUNTS[instrumentId]} MIDI notes from ${MIN_TUNER_MIDI_NOTE} to ${MAX_TUNER_MIDI_NOTE}.`,
      );
    }
    return validNotes;
  }

  private commit(tunings: readonly SavedCustomTuning[]): void {
    this.customTuningsSignal.set(tunings);
    this.persist();
  }

  private load(): LoadedTunerPreferences {
    if (!this.storage) return DEFAULT_LOADED;
    try {
      const raw = this.storage.getItem(TUNER_PREFERENCES_STORAGE_KEY);
      if (!raw) return DEFAULT_LOADED;
      const parsed = JSON.parse(raw) as unknown;
      return {
        tunings: parseTunings(parsed),
        tuner: readTunerSettings(parsed),
      };
    } catch {
      return DEFAULT_LOADED;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: PersistedTunerPreferences = {
      version: TUNER_PREFERENCES_VERSION,
      tunings: this.customTuningsSignal(),
      tuner: this.tunerSettingsSignal(),
    };
    try {
      this.storage.setItem(TUNER_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable or full; current-session state remains usable.
    }
  }

  setMode(mode: TunerMode): void {
    if (!isTunerMode(mode)) return;
    this.updateTuner({ mode });
  }

  setStartupMode(startupMode: TunerStartupMode): void {
    if (!isStartupMode(startupMode)) return;
    this.updateTuner({ startupMode });
  }

  setInTuneEnabled(enabled: boolean): void {
    this.updateInTune({ enabled });
  }

  setInTuneSound(sound: boolean): void {
    this.updateInTune({ sound });
  }

  setInTuneGlow(glow: boolean): void {
    this.updateInTune({ glow });
  }

  setInTuneColor(color: string): void {
    if (!HEX_COLOR.test(color)) return;
    this.updateInTune({ color: color.toLowerCase() });
  }

  setInTuneTolerance(tolerance: number): void {
    if (!Number.isFinite(tolerance)) return;
    this.updateInTune({ tolerance: clampTolerance(tolerance) });
  }

  setInTuneHoldMs(holdMs: number): void {
    if (!Number.isFinite(holdMs)) return;
    this.updateInTune({ holdMs: clampHoldMs(holdMs) });
  }

  private updateTuner(changes: Partial<TunerSettings>): void {
    this.tunerSettingsSignal.update((settings) => ({ ...settings, ...changes }));
    this.persist();
  }

  private updateInTune(changes: Partial<InTunePreferences>): void {
    this.tunerSettingsSignal.update((settings) => ({
      ...settings,
      inTune: { ...settings.inTune, ...changes },
    }));
    this.persist();
  }

  private createTuningId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `custom-${globalThis.crypto.randomUUID()}`;
    }
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
