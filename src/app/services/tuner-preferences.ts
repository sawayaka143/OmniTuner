import { inject, InjectionToken, Service, signal } from '@angular/core';
import {
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
  SavedCustomTuning,
  TUNER_STRING_COUNTS,
  TunerInstrumentId,
} from '../models/tuner-preferences.model';

export const TUNER_PREFERENCES_STORAGE_KEY = 'omnituner.tuner-preferences.v1';
export const TUNER_PREFERENCES_VERSION = 1;

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
  readonly version: typeof TUNER_PREFERENCES_VERSION;
  readonly tunings: readonly SavedCustomTuning[];
}

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
  if (!isRecord(value) || value['version'] !== TUNER_PREFERENCES_VERSION || !('tunings' in value)) {
    return [];
  }

  return readTunings(value['tunings']);
};

@Service()
export class TunerPreferences {
  private readonly storage = inject(TUNER_PREFERENCES_STORAGE);
  private readonly customTuningsSignal = signal<readonly SavedCustomTuning[]>(this.load());

  readonly customTunings = this.customTuningsSignal.asReadonly();

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

  private load(): readonly SavedCustomTuning[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(TUNER_PREFERENCES_STORAGE_KEY);
      return raw ? parseTunings(JSON.parse(raw) as unknown) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: PersistedTunerPreferences = {
      version: TUNER_PREFERENCES_VERSION,
      tunings: this.customTuningsSignal(),
    };
    try {
      this.storage.setItem(TUNER_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable or full; current-session state remains usable.
    }
  }

  private createTuningId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `custom-${globalThis.crypto.randomUUID()}`;
    }
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
