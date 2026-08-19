import { TestBed } from '@angular/core/testing';
import { DEFAULT_TUNER_SETTINGS } from '../models/tuner-preferences.model';
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

  it('starts with default settings', () => {
    expect(createService().tunerSettings()).toEqual(DEFAULT_TUNER_SETTINGS);
  });

  it('falls back safely when storage contains malformed JSON', () => {
    storage.setItem(TUNER_PREFERENCES_STORAGE_KEY, '{not-json');

    expect(createService().tunerSettings()).toEqual(DEFAULT_TUNER_SETTINGS);
  });

  it('restores tuner settings and clamps out-of-range values on load', () => {
    storage.setItem(
      TUNER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        tuner: {
          mode: 'manual',
          startupMode: 'auto',
          referencePitch: 500,
          inTune: {
            enabled: false,
            sound: false,
            glow: true,
            color: '#EE6600',
            outOfTuneColor: '#3366AA',
            tolerance: 900,
            holdMs: -42,
          },
        },
      }),
    );

    expect(createService().tunerSettings()).toEqual({
      mode: 'manual',
      startupMode: 'auto',
      referencePitch: 466,
      inTune: {
        enabled: false,
        sound: false,
        glow: true,
        color: '#ee6600',
        outOfTuneColor: '#3366aa',
        tolerance: 15,
        holdMs: 0,
      },
    });
  });

  it('persists tuner settings round-trip with the existing storage key', () => {
    const service = createService();
    service.setMode('manual');
    service.setStartupMode('remember');
    service.setInTuneEnabled(false);
    service.setInTuneSound(false);
    service.setInTuneGlow(true);
    service.setInTuneColor('#ff9900');
    service.setOutOfTuneColor('#00aacc');
    service.setInTuneTolerance(12);
    service.setInTuneHoldMs(800);
    service.setReferencePitch(442);

    TestBed.resetTestingModule();
    const restored = createService();

    expect(restored.tunerSettings()).toEqual({
      mode: 'manual',
      startupMode: 'remember',
      referencePitch: 442,
      inTune: {
        enabled: false,
        sound: false,
        glow: true,
        color: '#ff9900',
        outOfTuneColor: '#00aacc',
        tolerance: 12,
        holdMs: 800,
      },
    });
  });

  it('validates setter inputs: invalid colors and modes are ignored, ranges clamp', () => {
    const service = createService();

    service.setInTuneColor('not-a-color');
    expect(service.tunerSettings().inTune.color).toBe(DEFAULT_TUNER_SETTINGS.inTune.color);

    service.setOutOfTuneColor('not-a-color');
    expect(service.tunerSettings().inTune.outOfTuneColor).toBe(
      DEFAULT_TUNER_SETTINGS.inTune.outOfTuneColor,
    );

    service.setMode('magic' as never);
    expect(service.tunerSettings().mode).toBe('auto');

    service.setInTuneTolerance(99);
    expect(service.tunerSettings().inTune.tolerance).toBe(15);

    service.setInTuneTolerance(0.2);
    expect(service.tunerSettings().inTune.tolerance).toBe(1);

    service.setInTuneHoldMs(10_000);
    expect(service.tunerSettings().inTune.holdMs).toBe(1500);
  });

  describe('referencePitch', () => {
    it('defaults to 440', () => {
      expect(createService().tunerSettings().referencePitch).toBe(440);
    });

    it('sets and persists a valid reference pitch', () => {
      const service = createService();
      service.setReferencePitch(432);
      expect(service.tunerSettings().referencePitch).toBe(432);

      TestBed.resetTestingModule();
      expect(createService().tunerSettings().referencePitch).toBe(432);
    });

    it('clamps values below the minimum (415)', () => {
      const service = createService();
      service.setReferencePitch(300);
      expect(service.tunerSettings().referencePitch).toBe(415);
    });

    it('clamps values above the maximum (466)', () => {
      const service = createService();
      service.setReferencePitch(500);
      expect(service.tunerSettings().referencePitch).toBe(466);
    });

    it('ignores non-finite values', () => {
      const service = createService();
      service.setReferencePitch(NaN);
      expect(service.tunerSettings().referencePitch).toBe(440);

      service.setReferencePitch(Infinity);
      expect(service.tunerSettings().referencePitch).toBe(440);
    });

    it('rounds fractional values', () => {
      const service = createService();
      service.setReferencePitch(442.7);
      expect(service.tunerSettings().referencePitch).toBe(443);
    });
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

    service.setReferencePitch(432);

    expect(service.tunerSettings().referencePitch).toBe(432);
  });
});
