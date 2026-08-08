import { computed, inject, InjectionToken, Service, signal } from '@angular/core';
import { INSTRUMENTS } from '../data/instrument.constants';
import { Instrument, Tuning } from '../models/instrument.model';
import {
  MAX_CUSTOM_INSTRUMENT_NAME_LENGTH,
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_STRING_COUNT,
  MAX_TUNER_MIDI_NOTE,
  MIN_STRING_COUNT,
  MIN_TUNER_MIDI_NOTE,
  SavedCustomTuning,
} from '../models/tuner-preferences.model';
import { midiNoteLabel, midiNoteToFrequency } from '../utils/pitch-utils';

// ── Storage ──────────────────────────────────────────────────────────

export const INSTRUMENT_REGISTRY_STORAGE_KEY = 'omnituner.instruments.v1';

export const INSTRUMENT_REGISTRY_STORAGE = new InjectionToken<Storage | null>(
  'Instrument registry storage',
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

// ── Persisted shape ──────────────────────────────────────────────────

interface CustomInstrumentRecord {
  readonly id: string;
  readonly name: string;
  readonly stringCount: number;
  readonly defaultNotes: readonly number[];
}

interface PersistedRegistry {
  readonly version: 1;
  readonly customInstruments: readonly CustomInstrumentRecord[];
  readonly customTunings: readonly SavedCustomTuning[];
  readonly selectedInstrumentId: string;
  readonly selectedTuningId: string;
}

// ── Validation helpers ───────────────────────────────────────────────

const CUSTOM_INSTRUMENT_ID = /^instr-[a-z0-9-]+$/i;
const CUSTOM_TUNING_ID = /^custom-[a-z0-9-]+$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMidiNote = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_TUNER_MIDI_NOTE &&
  value <= MAX_TUNER_MIDI_NOTE;

const isStringCount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_STRING_COUNT &&
  value <= MAX_STRING_COUNT;

const readCustomInstruments = (value: unknown): readonly CustomInstrumentRecord[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const result: CustomInstrumentRecord[] = [];

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      !CUSTOM_INSTRUMENT_ID.test(entry['id']) ||
      seenIds.has(entry['id']) ||
      typeof entry['name'] !== 'string' ||
      !isStringCount(entry['stringCount']) ||
      !Array.isArray(entry['defaultNotes']) ||
      entry['defaultNotes'].length !== entry['stringCount'] ||
      !entry['defaultNotes'].every(isMidiNote)
    ) {
      continue;
    }

    const name = entry['name'].trim();
    if (!name || name.length > MAX_CUSTOM_INSTRUMENT_NAME_LENGTH) continue;

    seenIds.add(entry['id']);
    result.push({
      id: entry['id'],
      name,
      stringCount: entry['stringCount'],
      defaultNotes: [...entry['defaultNotes']],
    });
  }

  return result;
};

const readCustomTunings = (value: unknown): readonly SavedCustomTuning[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const result: SavedCustomTuning[] = [];

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      !CUSTOM_TUNING_ID.test(entry['id']) ||
      seenIds.has(entry['id']) ||
      typeof entry['instrumentId'] !== 'string' ||
      typeof entry['name'] !== 'string' ||
      !Array.isArray(entry['notes']) ||
      !entry['notes'].every(isMidiNote)
    ) {
      continue;
    }

    const name = entry['name'].trim();
    if (!name || name.length > MAX_CUSTOM_TUNING_NAME_LENGTH) continue;

    seenIds.add(entry['id']);
    result.push({
      id: entry['id'],
      instrumentId: entry['instrumentId'],
      name,
      notes: [...entry['notes']],
    });
  }

  return result;
};

// ── Service ──────────────────────────────────────────────────────────

@Service()
export class InstrumentRegistry {
  private readonly storage = inject(INSTRUMENT_REGISTRY_STORAGE);

  private readonly persisted = this.load();
  private readonly customInstrumentsSignal = signal<readonly CustomInstrumentRecord[]>(
    this.persisted.customInstruments,
  );
  private readonly customTuningsSignal = signal<readonly SavedCustomTuning[]>(
    this.persisted.customTunings,
  );
  private readonly selectedInstrumentSignal = signal(this.persisted.selectedInstrumentId);
  private readonly selectedTuningSignal = signal(this.persisted.selectedTuningId);

  // ── Public read-only signals ─────────────────────────────────────

  readonly selectedInstrumentId = this.selectedInstrumentSignal.asReadonly();
  readonly selectedTuningId = this.selectedTuningSignal.asReadonly();
  readonly customTunings = this.customTuningsSignal.asReadonly();

  /** All instruments: built-in first, then user-created. */
  readonly instruments = computed<readonly Instrument[]>(() => [
    ...INSTRUMENTS,
    ...this.customInstrumentsSignal().map((record) => this.toInstrument(record)),
  ]);

  readonly selectedInstrument = computed<Instrument>(() => {
    const id = this.selectedInstrumentSignal();
    return this.instruments().find((inst) => inst.id === id) ?? INSTRUMENTS[0];
  });

  /** Built-in + custom tunings for the selected instrument. */
  readonly availableTunings = computed<readonly Tuning[]>(() => {
    const instrument = this.selectedInstrument();
    const custom = this.customTuningsSignal()
      .filter((t) => t.instrumentId === instrument.id)
      .map((t) => this.toRuntimeTuning(t));
    return [...instrument.tunings, ...custom];
  });

  readonly selectedTuning = computed<Tuning>(() => {
    const tunings = this.availableTunings();
    const id = this.selectedTuningSignal();
    return tunings.find((t) => t.id === id) ?? tunings[0];
  });

  // ── Selection ────────────────────────────────────────────────────

  selectInstrument(instrumentId: string): void {
    const instrument = this.instruments().find((inst) => inst.id === instrumentId);
    if (!instrument) return;

    this.selectedInstrumentSignal.set(instrumentId);

    // If the current tuning doesn't belong to the new instrument, reset.
    const tunings = [
      ...instrument.tunings,
      ...this.customTuningsSignal()
        .filter((t) => t.instrumentId === instrumentId)
        .map((t) => this.toRuntimeTuning(t)),
    ];
    if (!tunings.some((t) => t.id === this.selectedTuningSignal())) {
      this.selectedTuningSignal.set(tunings[0]?.id ?? 'standard');
    }

    this.persist();
  }

  selectTuning(tuningId: string): void {
    if (!this.availableTunings().some((t) => t.id === tuningId)) return;
    this.selectedTuningSignal.set(tuningId);
    this.persist();
  }

  // ── Instrument CRUD ──────────────────────────────────────────────

  createInstrument(name: string, stringCount: number, defaultNotes: readonly number[]): Instrument {
    const validName = this.requireInstrumentName(name);
    const validCount = this.requireStringCount(stringCount);
    const validNotes = this.requireNotes(defaultNotes, validCount);

    const record: CustomInstrumentRecord = {
      id: this.createInstrumentId(),
      name: validName,
      stringCount: validCount,
      defaultNotes: validNotes,
    };

    this.customInstrumentsSignal.update((list) => [...list, record]);
    this.persist();
    return this.toInstrument(record);
  }

  updateInstrument(id: string, name: string, stringCount: number, defaultNotes: readonly number[]): Instrument {
    const instruments = this.customInstrumentsSignal();
    const index = instruments.findIndex((inst) => inst.id === id);
    if (index === -1) throw new RangeError('Custom instrument does not exist.');

    const validName = this.requireInstrumentName(name);
    const validCount = this.requireStringCount(stringCount);
    const validNotes = this.requireNotes(defaultNotes, validCount);

    const updated: CustomInstrumentRecord = { id, name: validName, stringCount: validCount, defaultNotes: validNotes };
    const next = [...instruments];
    next[index] = updated;
    this.customInstrumentsSignal.set(next);
    this.persist();
    return this.toInstrument(updated);
  }

  deleteInstrument(id: string): void {
    const instruments = this.customInstrumentsSignal();
    const next = instruments.filter((inst) => inst.id !== id);
    if (next.length === instruments.length) return;

    this.customInstrumentsSignal.set(next);

    // Also remove all custom tunings for this instrument.
    this.customTuningsSignal.update((tunings) => tunings.filter((t) => t.instrumentId !== id));

    // If the deleted instrument was selected, fall back to guitar/standard.
    if (this.selectedInstrumentSignal() === id) {
      this.selectedInstrumentSignal.set('guitar');
      this.selectedTuningSignal.set('standard');
    }

    this.persist();
  }

  // ── Tuning CRUD ──────────────────────────────────────────────────

  tuningsForInstrument(instrumentId: string): readonly SavedCustomTuning[] {
    return this.customTuningsSignal().filter((t) => t.instrumentId === instrumentId);
  }

  createTuning(instrumentId: string, name: string, notes: readonly number[]): SavedCustomTuning {
    const instrument = this.instruments().find((inst) => inst.id === instrumentId);
    if (!instrument) throw new RangeError('Instrument does not exist.');

    const tuning: SavedCustomTuning = {
      id: this.createTuningId(),
      instrumentId,
      name: this.requireTuningName(name),
      notes: this.requireNotes(notes, instrument.stringCount),
    };

    this.customTuningsSignal.update((list) => [...list, tuning]);
    this.persist();
    return tuning;
  }

  updateTuning(id: string, name: string, notes: readonly number[]): SavedCustomTuning {
    const tunings = this.customTuningsSignal();
    const index = tunings.findIndex((t) => t.id === id);
    if (index === -1) throw new RangeError('Custom tuning does not exist.');

    const existing = tunings[index];
    const instrument = this.instruments().find((inst) => inst.id === existing.instrumentId);
    const stringCount = instrument?.stringCount ?? notes.length;

    const updated: SavedCustomTuning = {
      ...existing,
      name: this.requireTuningName(name),
      notes: this.requireNotes(notes, stringCount),
    };

    const next = [...tunings];
    next[index] = updated;
    this.customTuningsSignal.set(next);
    this.persist();
    return updated;
  }

  deleteTuning(id: string): void {
    const tunings = this.customTuningsSignal();
    const next = tunings.filter((t) => t.id !== id);
    if (next.length === tunings.length) return;

    this.customTuningsSignal.set(next);

    // If the deleted tuning was selected, fall back to the first built-in.
    if (this.selectedTuningSignal() === id) {
      const instrument = this.selectedInstrument();
      this.selectedTuningSignal.set(instrument.tunings[0]?.id ?? 'standard');
    }

    this.persist();
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private toInstrument(record: CustomInstrumentRecord): Instrument {
    return {
      id: record.id,
      label: record.name,
      stringCount: record.stringCount,
      kind: 'custom',
      tunings: [
        {
          id: `${record.id}-default`,
          label: 'DEFAULT',
          strings: record.defaultNotes.map((note) => ({
            name: midiNoteLabel(note),
            freq: midiNoteToFrequency(note),
          })),
        },
      ],
    };
  }

  private toRuntimeTuning(tuning: SavedCustomTuning): Tuning {
    return {
      id: tuning.id,
      label: tuning.name,
      kind: 'custom',
      strings: tuning.notes.map((note) => ({
        name: midiNoteLabel(note),
        freq: midiNoteToFrequency(note),
      })),
    };
  }

  private requireInstrumentName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new RangeError('An instrument name is required.');
    if (normalized.length > MAX_CUSTOM_INSTRUMENT_NAME_LENGTH) {
      throw new RangeError(
        `Instrument names must be ${MAX_CUSTOM_INSTRUMENT_NAME_LENGTH} characters or fewer.`,
      );
    }
    return normalized;
  }

  private requireTuningName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new RangeError('A custom tuning name is required.');
    if (normalized.length > MAX_CUSTOM_TUNING_NAME_LENGTH) {
      throw new RangeError(
        `Custom tuning names must be ${MAX_CUSTOM_TUNING_NAME_LENGTH} characters or fewer.`,
      );
    }
    return normalized;
  }

  private requireStringCount(count: number): number {
    if (!Number.isInteger(count) || count < MIN_STRING_COUNT || count > MAX_STRING_COUNT) {
      throw new RangeError(`String count must be between ${MIN_STRING_COUNT} and ${MAX_STRING_COUNT}.`);
    }
    return count;
  }

  private requireNotes(notes: readonly number[], expectedCount: number): readonly number[] {
    if (
      !Array.isArray(notes) ||
      notes.length !== expectedCount ||
      !notes.every(isMidiNote)
    ) {
      throw new RangeError(
        `Tuning requires ${expectedCount} MIDI notes from ${MIN_TUNER_MIDI_NOTE} to ${MAX_TUNER_MIDI_NOTE}.`,
      );
    }
    return [...notes];
  }

  private createInstrumentId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `instr-${globalThis.crypto.randomUUID()}`;
    }
    return `instr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private createTuningId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `custom-${globalThis.crypto.randomUUID()}`;
    }
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  // ── Persistence ──────────────────────────────────────────────────

  private load(): PersistedRegistry {
    const fallback: PersistedRegistry = {
      version: 1,
      customInstruments: [],
      customTunings: [],
      selectedInstrumentId: 'guitar',
      selectedTuningId: 'standard',
    };

    if (!this.storage) return fallback;

    try {
      const raw = this.storage.getItem(INSTRUMENT_REGISTRY_STORAGE_KEY);
      if (!raw) return this.migrateOldTunings(fallback);

      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || parsed['version'] !== 1) return fallback;

      const customInstruments = readCustomInstruments(parsed['customInstruments']);
      const customTunings = readCustomTunings(parsed['customTunings']);

      // Validate persisted selection ids against the actual universe so a
      // stale id (deleted instrument/tuning, old version) falls back to a
      // real one instead of being re-persisted forever.
      const rawInstrumentId =
        typeof parsed['selectedInstrumentId'] === 'string'
          ? parsed['selectedInstrumentId']
          : 'guitar';
      const selectedInstrumentId =
        INSTRUMENTS.some((inst) => inst.id === rawInstrumentId) ||
        customInstruments.some((inst) => inst.id === rawInstrumentId)
          ? rawInstrumentId
          : 'guitar';

      const builtInTunings =
        INSTRUMENTS.find((inst) => inst.id === selectedInstrumentId)?.tunings ?? [];
      const validTuningIds = new Set<string>([
        ...builtInTunings.map((tuning) => tuning.id),
        ...customInstruments
          .filter((inst) => inst.id === selectedInstrumentId)
          .map((inst) => `${inst.id}-default`),
        ...customTunings
          .filter((tuning) => tuning.instrumentId === selectedInstrumentId)
          .map((tuning) => tuning.id),
      ]);
      const rawTuningId =
        typeof parsed['selectedTuningId'] === 'string' ? parsed['selectedTuningId'] : 'standard';
      const selectedTuningId = validTuningIds.has(rawTuningId)
        ? rawTuningId
        : (builtInTunings[0]?.id ?? 'standard');

      return {
        version: 1,
        customInstruments,
        customTunings,
        selectedInstrumentId,
        selectedTuningId,
      };
    } catch {
      return fallback;
    }
  }

  /** One-time migration: import custom tunings from the old TunerPreferences key. */
  private migrateOldTunings(fallback: PersistedRegistry): PersistedRegistry {
    if (!this.storage) return fallback;

    try {
      const oldRaw = this.storage.getItem('omnituner.tuner-preferences.v1');
      if (!oldRaw) return fallback;

      const oldParsed = JSON.parse(oldRaw) as unknown;
      if (!isRecord(oldParsed) || !Array.isArray(oldParsed['tunings'])) return fallback;

      const migrated = readCustomTunings(oldParsed['tunings']);
      if (migrated.length === 0) return fallback;

      const result: PersistedRegistry = { ...fallback, customTunings: migrated };
      // Persist immediately so the migration survives even if the app closes.
      this.storage.setItem(INSTRUMENT_REGISTRY_STORAGE_KEY, JSON.stringify(result));
      return result;
    } catch {
      return fallback;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: PersistedRegistry = {
      version: 1,
      customInstruments: this.customInstrumentsSignal(),
      customTunings: this.customTuningsSignal(),
      selectedInstrumentId: this.selectedInstrumentSignal(),
      selectedTuningId: this.selectedTuningSignal(),
    };
    try {
      this.storage.setItem(INSTRUMENT_REGISTRY_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable or full; session state remains usable.
    }
  }
}
