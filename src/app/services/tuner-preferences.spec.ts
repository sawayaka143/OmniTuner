import { TestBed } from '@angular/core/testing';
import {
  TUNER_PREFERENCES_STORAGE,
  TUNER_PREFERENCES_STORAGE_KEY,
  TunerPreferences,
} from './tuner-preferences';

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
const UKULELE_NOTES = [67, 60, 64, 69] as const;

describe('TunerPreferences', () => {
  let storage: Storage;

  const createService = (): TunerPreferences => {
    TestBed.configureTestingModule({
      providers: [{ provide: TUNER_PREFERENCES_STORAGE, useValue: storage }],
    });
    return TestBed.inject(TunerPreferences);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('saves and restores instrument-scoped custom tunings', () => {
    const service = createService();
    const saved = service.createTuning('guitar', '  Open G  ', [38, 43, 50, 55, 59, 62]);

    expect(saved.name).toBe('Open G');
    expect(service.tuningsForInstrument('guitar')).toEqual([saved]);

    TestBed.resetTestingModule();
    const restored = createService();
    expect(restored.customTunings()).toEqual([saved]);
  });

  it('updates a tuning in place while preserving its id and scope', () => {
    const service = createService();
    const first = service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);
    const second = service.createTuning('guitar', 'Drop D', [38, 45, 50, 55, 59, 64]);

    const updated = service.updateTuning(first.id, '  Open D  ', [38, 45, 50, 54, 57, 62]);

    expect(updated).toMatchObject({
      id: first.id,
      instrumentId: 'guitar',
      name: 'Open D',
    });
    expect(service.customTunings().map((tuning) => tuning.id)).toEqual([first.id, second.id]);
    expect(service.customTunings()[0].notes).toEqual([38, 45, 50, 54, 57, 62]);
  });

  it('scopes tunings by instrument and validates ids, string counts, and note ranges', () => {
    const service = createService();
    const guitar = service.createTuning('guitar', 'Standard copy', GUITAR_NOTES);
    const ukulele = service.createTuning('ukulele', 'Re-entrant', UKULELE_NOTES);

    expect(service.tuningsForInstrument('guitar')).toEqual([guitar]);
    expect(service.tuningsForInstrument('ukulele')).toEqual([ukulele]);
    expect(service.tuningsForInstrument('mandolin')).toEqual([]);
    expect(() => service.createTuning('mandolin', 'Fifths', [55, 62, 69, 76])).toThrow(RangeError);
    expect(() => service.createTuning('guitar', 'Too few', UKULELE_NOTES)).toThrow(RangeError);
    expect(() => service.createTuning('ukulele', 'Too low', [34, 60, 64, 69])).toThrow(RangeError);
    expect(() => service.createTuning('ukulele', 'Too high', [67, 60, 64, 87])).toThrow(RangeError);
  });

  it('deletes only the requested tuning', () => {
    const service = createService();
    const guitar = service.createTuning('guitar', 'Open G', [38, 43, 50, 55, 59, 62]);
    const ukulele = service.createTuning('ukulele', 'Low G', [55, 60, 64, 69]);

    service.deleteTuning(guitar.id);

    expect(service.customTunings()).toEqual([ukulele]);
  });

  it('falls back safely when storage contains malformed JSON', () => {
    storage.setItem(TUNER_PREFERENCES_STORAGE_KEY, '{not-json');

    expect(createService().customTunings()).toEqual([]);
  });

  it('restores valid entries while discarding malformed persisted tunings', () => {
    storage.setItem(
      TUNER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        tunings: [
          {
            id: 'custom-valid',
            instrumentId: 'guitar',
            name: '  Valid  ',
            notes: GUITAR_NOTES,
          },
          {
            id: 'standard',
            instrumentId: 'guitar',
            name: 'Preset collision',
            notes: GUITAR_NOTES,
          },
          {
            id: 'custom-wrong-count',
            instrumentId: 'ukulele',
            name: 'Wrong count',
            notes: GUITAR_NOTES,
          },
          {
            id: 'custom-bad-note',
            instrumentId: 'guitar',
            name: 'Bad note',
            notes: [34, 45, 50, 55, 59, 64],
          },
        ],
      }),
    );

    expect(createService().customTunings()).toEqual([
      {
        id: 'custom-valid',
        instrumentId: 'guitar',
        name: 'Valid',
        notes: GUITAR_NOTES,
      },
    ]);
  });

  it('keeps current-session changes when storage is full', () => {
    storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      },
    };
    const service = createService();

    const saved = service.createTuning('guitar', 'Standard copy', GUITAR_NOTES);

    expect(service.customTunings()).toEqual([saved]);
  });
});
