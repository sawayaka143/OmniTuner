import { TestBed } from '@angular/core/testing';

import { DEFAULT_METRONOME_STATE } from '../models/metronome.model';
import {
  METRONOME_STORAGE_KEY,
  MetronomePreferences,
  METRONOME_STORAGE,
} from './metronome-preferences';

const makeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length(): number {
      return map.size;
    },
    clear: (): void => map.clear(),
    getItem: (key: string): string | null => map.get(key) ?? null,
    key: (): string | null => null,
    removeItem: (key: string): void => void map.delete(key),
    setItem: (key: string, value: string): void => void map.set(key, value),
  };
};

const setup = (storage: Storage): MetronomePreferences => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: METRONOME_STORAGE, useValue: storage }],
  });
  return TestBed.inject(MetronomePreferences);
};

describe('MetronomePreferences', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('starts with count-in off and default ramp', () => {
    const prefs = setup(storage);
    expect(prefs.state().countIn).toBe(false);
    expect(prefs.state().ramp).toEqual({
      enabled: false,
      targetBpm: 120,
      bars: 8,
    });
  });

  it('persists count-in and clamps ramp values across instances', () => {
    const prefs = setup(storage);
    prefs.setCountIn(true);
    prefs.setRamp({ enabled: true, targetBpm: 5000, bars: -4 });

    const reloaded = setup(storage);
    expect(reloaded.state().countIn).toBe(true);
    expect(reloaded.state().ramp).toEqual({
      enabled: true,
      targetBpm: 800,
      bars: 1,
    });
  });

  it('saves, applies and deletes full-state presets', () => {
    const prefs = setup(storage);
    prefs.setBpm(140);
    const preset = prefs.savePreset('Driving');
    expect(preset).not.toBeNull();
    expect(prefs.presets()[0]?.name).toBe('Driving');
    expect(prefs.presets()[0]?.state.bpm).toBe(140);

    prefs.setBpm(90);
    prefs.applyPreset(preset!.id);
    expect(prefs.state().bpm).toBe(140);

    prefs.deletePreset(preset!.id);
    expect(prefs.presets()).toEqual([]);
  });

  it('round-trips presets through storage', () => {
    const prefs = setup(storage);
    prefs.setCountIn(true);
    prefs.savePreset('Round trip');

    const reloaded = setup(storage);
    expect(reloaded.presets().length).toBe(1);
    expect(reloaded.presets()[0]?.name).toBe('Round trip');
    expect(reloaded.presets()[0]?.state.countIn).toBe(true);
  });

  it('ignores an unknown preset id (state unchanged)', () => {
    const prefs = setup(storage);
    prefs.setBpm(140);
    prefs.applyPreset('does-not-exist');
    expect(prefs.state().bpm).toBe(140);
  });

  it('loads legacy v2 payloads with count-in off and no presets', () => {
    storage.setItem(
      METRONOME_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        state: { ...DEFAULT_METRONOME_STATE, bpm: 150 },
      }),
    );
    const prefs = setup(storage);
    expect(prefs.state().bpm).toBe(150);
    expect(prefs.state().countIn).toBe(false);
    expect(prefs.presets()).toEqual([]);
  });
});
