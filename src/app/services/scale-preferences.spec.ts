import { TestBed } from '@angular/core/testing';
import { DEFAULT_SCALE_PREFERENCES } from '../data/scale-tuning.constants';
import {
  SCALE_PREFERENCES_STORAGE,
  SCALE_PREFERENCES_STORAGE_KEY,
  ScalePreferences,
} from './scale-preferences';

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

describe('ScalePreferences', () => {
  let storage: MemoryStorage;

  const createService = (): ScalePreferences => {
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_PREFERENCES_STORAGE, useValue: storage }],
    });
    return TestBed.inject(ScalePreferences);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts with the reference defaults', () => {
    const service = createService();

    expect(service.state()).toEqual(DEFAULT_SCALE_PREFERENCES);
    expect(service.selectedTuning().id).toBe('standard');
  });

  it('persists display and theory choices', () => {
    const service = createService();

    service.setRootPitchClass(10);
    service.setScaleId('dorian');
    service.setAccidental('flat');
    service.setFretCount(21);
    service.setLabelMode('scale-degrees');
    service.setShowOutsideScale(true);
    service.setAccent('#227799');
    service.setRootNoteColor('#fefefe');
    service.setNoteColor('#30302a');

    TestBed.resetTestingModule();
    const restored = createService();
    expect(restored.state()).toMatchObject({
      rootPitchClass: 10,
      scaleId: 'dorian',
      accidental: 'flat',
      fretCount: 21,
      labelMode: 'scale-degrees',
      showOutsideScale: true,
      accent: '#227799',
      rootNoteColor: '#fefefe',
      noteColor: '#30302a',
    });
  });

  it('falls back safely when persisted JSON is malformed', () => {
    storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, '{not-json');

    expect(createService().state()).toEqual(DEFAULT_SCALE_PREFERENCES);
  });

  it('sanitizes invalid persisted fields independently', () => {
    storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 1,
      state: {
        rootPitchClass: 99,
        scaleId: 'unknown',
        accidental: 'natural',
        fretCount: 18,
        labelMode: 'invalid',
        showOutsideScale: null,
        selectedTuning: { kind: 'preset', id: 'missing' },
        savedTunings: [{ id: 'broken', name: '', notes: [1, 2] }],
        accent: 'red',
        rootNoteColor: 'white',
        noteColor: '#12345',
      },
    }));

    expect(createService().state()).toEqual(DEFAULT_SCALE_PREFERENCES);
  });

  it('saves and restores octave-aware custom tunings', () => {
    const service = createService();
    const tuning = service.saveTuning('  Open E  ', [40, 47, 52, 56, 59, 64]);

    expect(tuning.name).toBe('Open E');
    expect(service.state().selectedTuning).toEqual({ kind: 'custom', id: tuning.id });
    expect(service.selectedTuning().notes).toEqual([40, 47, 52, 56, 59, 64]);

    TestBed.resetTestingModule();
    const restored = createService();
    expect(restored.selectedTuning()).toEqual(tuning);
  });

  it('assigns a fallback name to unnamed custom tunings', () => {
    const service = createService();

    expect(service.saveTuning('   ', [40, 45, 50, 55, 59, 64]).name).toBe('Custom 1');
  });

  it('rejects custom notes outside the editor range', () => {
    const service = createService();

    expect(() => service.saveTuning('Invalid', [23, 45, 50, 55, 59, 64])).toThrow(RangeError);
  });

  it('updates a saved tuning in place, selects it, and persists the changes', () => {
    const service = createService();
    const first = service.saveTuning('First', [40, 45, 50, 55, 59, 64]);
    const second = service.saveTuning('Second', [38, 45, 50, 55, 59, 62]);
    service.selectTuning({ kind: 'preset', id: 'standard' });

    const updated = service.updateTuning(first.id, '  Open E  ', [40, 47, 52, 56, 59, 64]);

    expect(updated).toEqual({
      id: first.id,
      name: 'Open E',
      notes: [40, 47, 52, 56, 59, 64],
    });
    expect(service.state().savedTunings).toEqual([updated, second]);
    expect(service.state().selectedTuning).toEqual({ kind: 'custom', id: first.id });

    TestBed.resetTestingModule();
    const restored = createService();
    expect(restored.selectedTuning()).toEqual(updated);
    expect(restored.state().savedTunings).toEqual([updated, second]);
  });

  it('returns null without changing state when the tuning ID is missing', () => {
    const service = createService();
    service.saveTuning('Open G', [38, 43, 50, 55, 59, 62]);
    const stateBeforeUpdate = service.state();
    const persistedBeforeUpdate = storage.getItem(SCALE_PREFERENCES_STORAGE_KEY);

    expect(service.updateTuning('missing', 'Other', [40, 45, 50, 55, 59, 64])).toBeNull();
    expect(service.state()).toBe(stateBeforeUpdate);
    expect(storage.getItem(SCALE_PREFERENCES_STORAGE_KEY)).toBe(persistedBeforeUpdate);
  });

  it('rejects invalid notes when updating a saved tuning', () => {
    const service = createService();
    const tuning = service.saveTuning('Open G', [38, 43, 50, 55, 59, 62]);
    const stateBeforeUpdate = service.state();

    expect(() => service.updateTuning(tuning.id, 'Invalid', [23, 43, 50, 55, 59, 62]))
      .toThrow(RangeError);
    expect(service.state()).toBe(stateBeforeUpdate);
  });

  it('returns to Standard when the selected custom tuning is deleted', () => {
    const service = createService();
    const tuning = service.saveTuning('Open G', [38, 43, 50, 55, 59, 62]);

    service.deleteTuning(tuning.id);

    expect(service.state().savedTunings).toEqual([]);
    expect(service.state().selectedTuning).toEqual({ kind: 'preset', id: 'standard' });
  });

  describe('workbenchScale', () => {
    it('defaults to 1', () => {
      expect(createService().state().workbenchScale).toBe(1);
    });

    it('persists across reload', () => {
      const service = createService();
      service.setWorkbenchScale(1.15);

      TestBed.resetTestingModule();
      expect(createService().state().workbenchScale).toBe(1.15);
    });

    it('clamps values outside [0.75, 1.30]', () => {
      const service = createService();
      service.setWorkbenchScale(0.5);
      expect(service.state().workbenchScale).toBe(0.75);

      service.setWorkbenchScale(2);
      expect(service.state().workbenchScale).toBe(1.30);
    });

    it('rejects non-finite values', () => {
      const service = createService();
      const before = service.state().workbenchScale;
      service.setWorkbenchScale(NaN);
      expect(service.state().workbenchScale).toBe(before);

      service.setWorkbenchScale(Infinity);
      expect(service.state().workbenchScale).toBe(before);
    });

    it('snaps to the step increment', () => {
      const service = createService();
      service.setWorkbenchScale(0.77);
      expect(service.state().workbenchScale).toBe(0.75);

      service.setWorkbenchScale(1.22);
      expect(service.state().workbenchScale).toBe(1.20);
    });

    it('falls back to 1 when stored value is missing or out of range', () => {
      storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify({
        version: 1,
        state: { /* no workbenchScale field */ },
      }));
      expect(createService().state().workbenchScale).toBe(1);

      storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify({
        version: 1,
        state: { workbenchScale: 'invalid' },
      }));
      expect(createService().state().workbenchScale).toBe(1);

      storage.setItem(SCALE_PREFERENCES_STORAGE_KEY, JSON.stringify({
        version: 1,
        state: { workbenchScale: 5 },
      }));
      expect(createService().state().workbenchScale).toBe(1);
    });

    it('resetWorkbenchScale returns to 1', () => {
      const service = createService();
      service.setWorkbenchScale(1.25);
      service.resetWorkbenchScale();
      expect(service.state().workbenchScale).toBe(1);
    });
  });
});
