import { TestBed } from '@angular/core/testing';
import { INSTRUMENTS } from '../data/instrument.constants';
import {
  INSTRUMENT_REGISTRY_STORAGE,
  INSTRUMENT_REGISTRY_STORAGE_KEY,
  InstrumentRegistry,
} from './instrument-registry';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const GUITAR_NOTES = [40, 45, 50, 55, 59, 64] as const;

describe('InstrumentRegistry', () => {
  let storage: MemoryStorage;

  const createService = (): InstrumentRegistry => {
    TestBed.configureTestingModule({
      providers: [{ provide: INSTRUMENT_REGISTRY_STORAGE, useValue: storage }],
    });
    return TestBed.inject(InstrumentRegistry);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('initial state', () => {
    it('exposes built-in instruments', () => {
      const service = createService();
      expect(service.instruments().length).toBe(INSTRUMENTS.length);
      expect(service.instruments()[0].id).toBe('guitar');
    });

    it('defaults to guitar/standard selection', () => {
      const service = createService();
      expect(service.selectedInstrumentId()).toBe('guitar');
      expect(service.selectedTuningId()).toBe('standard');
      expect(service.selectedInstrument().id).toBe('guitar');
      expect(service.selectedTuning().id).toBe('standard');
    });
  });

  describe('selection', () => {
    it('selects an instrument and persists', () => {
      const service = createService();
      service.selectInstrument('ukulele');
      expect(service.selectedInstrumentId()).toBe('ukulele');

      TestBed.resetTestingModule();
      expect(createService().selectedInstrumentId()).toBe('ukulele');
    });

    it('resets tuning when switching to an instrument without the current tuning', () => {
      const service = createService();
      service.selectInstrument('ukulele');

      const tunings = service.availableTunings();
      expect(tunings.some((t) => t.id === service.selectedTuningId())).toBe(true);
    });

    it('selects a tuning and persists', () => {
      const service = createService();
      const tunings = service.availableTunings();
      const second = tunings[1];
      service.selectTuning(second.id);
      expect(service.selectedTuningId()).toBe(second.id);

      TestBed.resetTestingModule();
      expect(createService().selectedTuningId()).toBe(second.id);
    });

    it('ignores selecting a non-existent tuning', () => {
      const service = createService();
      service.selectTuning('nonexistent');
      expect(service.selectedTuningId()).toBe('standard');
    });
  });

  describe('instrument CRUD', () => {
    it('creates a custom instrument', () => {
      const service = createService();
      const instrument = service.createInstrument('Sitar', 7, [36, 41, 46, 51, 56, 61, 66]);

      expect(instrument.label).toBe('Sitar');
      expect(instrument.stringCount).toBe(7);
      expect(instrument.kind).toBe('custom');
      expect(service.instruments().length).toBe(INSTRUMENTS.length + 1);
    });

    it('persists custom instruments across reload', () => {
      const service = createService();
      service.createInstrument('Sitar', 7, [36, 41, 46, 51, 56, 61, 66]);

      TestBed.resetTestingModule();
      const restored = createService();
      expect(restored.instruments().length).toBe(INSTRUMENTS.length + 1);
      expect(restored.instruments().at(-1)?.label).toBe('Sitar');
    });

    it('updates a custom instrument', () => {
      const service = createService();
      const created = service.createInstrument('Sitar', 7, [36, 41, 46, 51, 56, 61, 66]);
      const updated = service.updateInstrument(created.id, 'Oud', 6, GUITAR_NOTES);

      expect(updated.label).toBe('Oud');
      expect(updated.stringCount).toBe(6);
    });

    it('deletes a custom instrument and its tunings', () => {
      const service = createService();
      const created = service.createInstrument('Sitar', 6, GUITAR_NOTES);
      service.createTuning(created.id, 'Custom tuning', GUITAR_NOTES);
      service.selectInstrument(created.id);

      service.deleteInstrument(created.id);

      expect(service.instruments().length).toBe(INSTRUMENTS.length);
      expect(service.selectedInstrumentId()).toBe('guitar');
      expect(service.selectedTuningId()).toBe('standard');
    });

    it('validates instrument name', () => {
      const service = createService();
      expect(() => service.createInstrument('', 6, GUITAR_NOTES)).toThrow(RangeError);
      expect(() => service.createInstrument('   ', 6, GUITAR_NOTES)).toThrow(RangeError);
      expect(() => service.createInstrument('x'.repeat(31), 6, GUITAR_NOTES)).toThrow(RangeError);
    });

    it('validates string count', () => {
      const service = createService();
      expect(() => service.createInstrument('Test', 0, [])).toThrow(RangeError);
      expect(() => service.createInstrument('Test', 13, Array(13).fill(40))).toThrow(RangeError);
    });

    it('validates notes match string count and range', () => {
      const service = createService();
      expect(() => service.createInstrument('Test', 6, [40, 45])).toThrow(RangeError);
      expect(() => service.createInstrument('Test', 6, [22, 45, 50, 55, 59, 64])).toThrow(
        RangeError,
      );
      expect(() => service.createInstrument('Test', 6, [40, 45, 50, 55, 59, 87])).toThrow(
        RangeError,
      );
    });
  });

  describe('tuning CRUD', () => {
    it('creates a custom tuning for an instrument', () => {
      const service = createService();
      const tuning = service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);

      expect(tuning.name).toBe('Open G');
      expect(tuning.instrumentId).toBe('guitar');
      expect(service.tuningsForInstrument('guitar')).toEqual([tuning]);
    });

    it('persists custom tunings across reload', () => {
      const service = createService();
      service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);

      TestBed.resetTestingModule();
      expect(createService().tuningsForInstrument('guitar').length).toBe(1);
    });

    it('updates a custom tuning', () => {
      const service = createService();
      const tuning = service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);
      const updated = service.updateTuning(tuning.id, 'Open D', [38, 45, 50, 54, 57, 62]);

      expect(updated.name).toBe('Open D');
      expect(updated.notes).toEqual([38, 45, 50, 54, 57, 62]);
    });

    it('deletes a custom tuning and resets selection if needed', () => {
      const service = createService();
      const tuning = service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);
      service.selectTuning(tuning.id);

      service.deleteTuning(tuning.id);

      expect(service.tuningsForInstrument('guitar')).toEqual([]);
      expect(service.selectedTuningId()).toBe('standard');
    });

    it('validates tuning name and notes', () => {
      const service = createService();
      expect(() => service.createTuning('guitar', '', GUITAR_NOTES)).toThrow(RangeError);
      expect(() => service.createTuning('guitar', 'Test', [40, 45])).toThrow(RangeError);
      expect(() => service.createTuning('nonexistent', 'Test', GUITAR_NOTES)).toThrow(RangeError);
    });

    it('includes custom tunings in availableTunings', () => {
      const service = createService();
      service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);

      const available = service.availableTunings();
      expect(available.some((t) => t.label === 'Open G' && t.kind === 'custom')).toBe(true);
    });
  });

  describe('migration', () => {
    it('imports custom tunings from old tuner-preferences key', () => {
      storage.setItem(
        'omnituner.tuner-preferences.v1',
        JSON.stringify({
          version: 2,
          tunings: [
            {
              id: 'custom-legacy',
              instrumentId: 'guitar',
              name: 'Legacy',
              notes: GUITAR_NOTES,
            },
          ],
        }),
      );

      const service = createService();
      expect(service.tuningsForInstrument('guitar').length).toBe(1);
      expect(service.tuningsForInstrument('guitar')[0].name).toBe('Legacy');
    });

    it('does not migrate when the registry key already exists', () => {
      storage.setItem(
        INSTRUMENT_REGISTRY_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          customInstruments: [],
          customTunings: [],
          selectedInstrumentId: 'guitar',
          selectedTuningId: 'standard',
        }),
      );
      storage.setItem(
        'omnituner.tuner-preferences.v1',
        JSON.stringify({
          version: 2,
          tunings: [{ id: 'custom-old', instrumentId: 'guitar', name: 'Old', notes: GUITAR_NOTES }],
        }),
      );

      const service = createService();
      expect(service.tuningsForInstrument('guitar')).toEqual([]);
    });
  });

  describe('persistence resilience', () => {
    it('falls back safely when storage contains malformed JSON', () => {
      storage.setItem(INSTRUMENT_REGISTRY_STORAGE_KEY, '{not-json');
      const service = createService();
      expect(service.instruments().length).toBe(INSTRUMENTS.length);
      expect(service.selectedInstrumentId()).toBe('guitar');
    });

    it('keeps session state when storage is full', () => {
      const fullStorage: Storage = {
        length: 0,
        clear: () => undefined,
        getItem: () => null,
        key: () => null,
        removeItem: () => undefined,
        setItem: () => {
          throw new DOMException('Storage full', 'QuotaExceededError');
        },
      };
      TestBed.configureTestingModule({
        providers: [{ provide: INSTRUMENT_REGISTRY_STORAGE, useValue: fullStorage }],
      });
      const service = TestBed.inject(InstrumentRegistry);

      const instrument = service.createInstrument('Test', 6, GUITAR_NOTES);
      expect(service.instruments().some((i) => i.id === instrument.id)).toBe(true);
    });
  });
});
