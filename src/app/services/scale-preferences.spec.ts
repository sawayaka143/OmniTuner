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
    expect(createService().state()).toEqual(DEFAULT_SCALE_PREFERENCES);
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
    storage.setItem(
      SCALE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          rootPitchClass: 99,
          scaleId: 'unknown',
          accidental: 'natural',
          fretCount: 18,
          labelMode: 'invalid',
          showOutsideScale: null,
          accent: 'red',
          rootNoteColor: 'white',
          noteColor: '#12345',
        },
      }),
    );

    expect(createService().state()).toEqual(DEFAULT_SCALE_PREFERENCES);
  });

  it('upgrades persisted legacy default colors to the current palette', () => {
    storage.setItem(
      SCALE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          accent: '#ffffff',
          rootNoteColor: '#ffffff',
          noteColor: '#2e2e28',
        },
      }),
    );

    expect(createService().state()).toMatchObject({
      accent: DEFAULT_SCALE_PREFERENCES.accent,
      rootNoteColor: DEFAULT_SCALE_PREFERENCES.rootNoteColor,
      noteColor: DEFAULT_SCALE_PREFERENCES.noteColor,
    });
  });

  it('leaves customized colors untouched while upgrading stale defaults', () => {
    storage.setItem(
      SCALE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          accent: '#123456',
          rootNoteColor: '#ffffff',
          noteColor: '#3b3b3b',
        },
      }),
    );

    expect(createService().state()).toMatchObject({
      accent: '#123456',
      rootNoteColor: DEFAULT_SCALE_PREFERENCES.rootNoteColor,
      noteColor: '#3b3b3b',
    });
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
      expect(service.state().workbenchScale).toBe(1.3);
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
      expect(service.state().workbenchScale).toBe(1.2);
    });

    it('falls back to defaults for missing/invalid stored workbenchScale and clamps out-of-range values', () => {
      storage.setItem(
        SCALE_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          state: {/* no workbenchScale field */},
        }),
      );
      expect(createService().state().workbenchScale).toBe(1);

      TestBed.resetTestingModule();
      storage.setItem(
        SCALE_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          state: { workbenchScale: 'invalid' },
        }),
      );
      expect(createService().state().workbenchScale).toBe(1);

      TestBed.resetTestingModule();
      storage.setItem(
        SCALE_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          state: { workbenchScale: 5 },
        }),
      );
      expect(createService().state().workbenchScale).toBe(1.3);
    });

    it('resetWorkbenchScale returns to 1', () => {
      const service = createService();
      service.setWorkbenchScale(1.25);
      service.resetWorkbenchScale();
      expect(service.state().workbenchScale).toBe(1);
    });
  });
});
