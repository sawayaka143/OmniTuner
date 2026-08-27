import { InjectionToken, Service, inject, signal } from '@angular/core';
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_METRONOME_STATE,
  DENOMINATORS,
  Denominator,
  MetronomeSoundRoles,
  MetronomeState,
  PATTERN_MAX_BARS,
  PATTERN_MIN_BARS,
  PolyState,
  POLY_MAX,
  POLY_MIN,
} from '../models/metronome.model';
import { SoundBank } from '../utils/metronome-sounds';

export const METRONOME_STORAGE_KEY = 'omnituner.metronome.v1';
export const METRONOME_STORAGE = new InjectionToken<Storage | null>('Metronome storage', {
  factory: () => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  },
});

interface Persisted {
  readonly version: 2;
  readonly state: MetronomeState;
}

const clampBpm = (v: number): number => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));
const clampVolume = (v: number): number => Math.min(1, Math.max(0, v));

const isDenominator = (v: unknown): v is Denominator =>
  typeof v === 'number' && (DENOMINATORS as readonly number[]).includes(v);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const readState = (raw: unknown): MetronomeState => {
  const fallback = DEFAULT_METRONOME_STATE;
  if (!isRecord(raw) || !isRecord(raw['state'])) return fallback;
  const state = raw['state'];

  const bpm =
    typeof state['bpm'] === 'number' && Number.isFinite(state['bpm'])
      ? clampBpm(state['bpm'])
      : fallback.bpm;

  let numerator = fallback.timeSignature.numerator;
  let denominator: Denominator = fallback.timeSignature.denominator;
  if (isRecord(state['timeSignature'])) {
    const num = state['timeSignature']['numerator'];
    const den = state['timeSignature']['denominator'];
    if (typeof num === 'number' && Number.isInteger(num) && num >= 1 && num <= 32) numerator = num;
    if (isDenominator(den)) denominator = den;
  }

  let divisionsPerBeat = fallback.divisionsPerBeat;
  if (
    typeof state['divisionsPerBeat'] === 'number' &&
    Number.isInteger(state['divisionsPerBeat'])
  ) {
    divisionsPerBeat = Math.min(12, Math.max(1, state['divisionsPerBeat']));
  }

  let barPattern: readonly number[] = fallback.barPattern;
  if (Array.isArray(state['barPattern'])) {
    const arr = state['barPattern'].filter(
      (v) => typeof v === 'number' && (v === 0 || v === 1),
    ) as number[];
    if (arr.length >= PATTERN_MIN_BARS && arr.length <= PATTERN_MAX_BARS) barPattern = arr;
  } else if (Array.isArray(state['pattern'])) {
    const arr = (state['pattern'] as unknown[]).filter(
      (v) => typeof v === 'number' && (v === 0 || v === 1),
    ) as number[];
    if (arr.length >= PATTERN_MIN_BARS && arr.length <= PATTERN_MAX_BARS) barPattern = arr;
  } else if (Array.isArray(state['barPatternBool'])) {
    const arr = (state['barPatternBool'] as unknown[]).filter((v) => typeof v === 'boolean');
    if (arr.length >= PATTERN_MIN_BARS && arr.length <= PATTERN_MAX_BARS)
      barPattern = arr.map((v) => (v ? 1 : 0));
  }

  let poly: PolyState = fallback.poly;
  if (isRecord(state['poly'])) {
    const enabled =
      typeof state['poly']['enabled'] === 'boolean'
        ? state['poly']['enabled']
        : fallback.poly.enabled;
    const eventsRaw = state['poly']['events'];
    const pEvents =
      typeof eventsRaw === 'number' &&
      Number.isInteger(eventsRaw) &&
      eventsRaw >= POLY_MIN &&
      eventsRaw <= POLY_MAX
        ? eventsRaw
        : fallback.poly.events;
    const accentFirst =
      typeof state['poly']['accentFirst'] === 'boolean'
        ? state['poly']['accentFirst']
        : fallback.poly.accentFirst;
    poly = { enabled, events: pEvents, accentFirst };
  } else if (isRecord(state['polyLegacy'])) {
    const enabled =
      typeof state['polyLegacy']['enabled'] === 'boolean'
        ? state['polyLegacy']['enabled']
        : fallback.poly.enabled;
    const ratio = state['polyLegacy']['ratio'];
    let events = fallback.poly.events;
    if (isRecord(ratio) && typeof ratio['b'] === 'number' && Number.isInteger(ratio['b'])) {
      events = Math.min(POLY_MAX, Math.max(POLY_MIN, ratio['b']));
    }
    poly = { enabled, events, accentFirst: true };
  }

  let sounds: MetronomeSoundRoles = fallback.sounds;
  if (isRecord(state['sounds'])) {
    const readRole = (
      key: string,
      fb: { id: string; vol: number; accentVol?: number },
    ): { id: string; vol: number; accentVol: number } => {
      const raw = (state['sounds'] as Record<string, unknown>)[key];
      if (!isRecord(raw))
        return { id: fb.id, vol: fb.vol, accentVol: (fb as { accentVol?: number }).accentVol ?? 1 };
      const id = typeof raw['id'] === 'string' && SoundBank.has(raw['id']) ? raw['id'] : fb.id;
      const vol =
        typeof raw['vol'] === 'number' && Number.isFinite(raw['vol'])
          ? clampVolume(raw['vol'])
          : fb.vol;
      const accentVol =
        typeof raw['accentVol'] === 'number' && Number.isFinite(raw['accentVol'])
          ? clampVolume(raw['accentVol'])
          : ((fb as { accentVol?: number }).accentVol ?? 1);
      return { id, vol, accentVol };
    };
    sounds = {
      downbeat: readRole('downbeat', fallback.sounds.downbeat),
      beat: readRole('beat', fallback.sounds.beat),
      subdivision: readRole('subdivision', fallback.sounds.subdivision),
      poly: readRole('poly', fallback.sounds.poly),
    };
  }

  const masterVol =
    typeof state['masterVol'] === 'number' && Number.isFinite(state['masterVol'])
      ? clampVolume(state['masterVol'])
      : typeof state['masterVolume'] === 'number'
        ? clampVolume(state['masterVolume'])
        : fallback.masterVol;

  return {
    bpm,
    timeSignature: { numerator, denominator },
    divisionsPerBeat,
    barPattern,
    poly,
    sounds,
    masterVol,
  };
};

@Service()
export class MetronomePreferences {
  private readonly storage = inject(METRONOME_STORAGE);
  private readonly stateSignal = signal<MetronomeState>(this.load());

  readonly state = this.stateSignal.asReadonly();

  setBpm(bpm: number): void {
    if (!Number.isFinite(bpm)) return;
    this.update({ bpm: clampBpm(bpm) });
  }

  setTimeSignature(numerator: number, denominator: Denominator): void {
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) return;
    if (!isDenominator(denominator)) return;
    this.update({ timeSignature: { numerator, denominator } });
  }

  setDivisionsPerBeat(value: number): void {
    if (!Number.isInteger(value)) return;
    this.update({ divisionsPerBeat: Math.min(12, Math.max(1, value)) });
  }

  setBarPattern(pattern: readonly number[]): void {
    if (
      !Array.isArray(pattern) ||
      pattern.length < PATTERN_MIN_BARS ||
      pattern.length > PATTERN_MAX_BARS
    )
      return;
    if (!pattern.every((v) => v === 0 || v === 1)) return;
    this.update({ barPattern: [...pattern] });
  }

  setPoly(patch: Partial<PolyState>): void {
    const current = this.stateSignal().poly;
    const next: PolyState = {
      enabled: patch.enabled ?? current.enabled,
      events:
        patch.events !== undefined
          ? Math.min(POLY_MAX, Math.max(POLY_MIN, Math.round(patch.events)))
          : current.events,
      accentFirst: patch.accentFirst ?? current.accentFirst,
    };
    this.update({ poly: next });
  }

  setSounds(patch: Partial<MetronomeSoundRoles>): void {
    const current = this.stateSignal().sounds;
    this.update({ sounds: { ...current, ...patch } });
  }

  setSoundRole(
    role: keyof MetronomeSoundRoles,
    id: string,
    vol?: number,
    accentVol?: number,
  ): void {
    if (!SoundBank.has(id)) return;
    const current = this.stateSignal().sounds[role] as {
      id: string;
      vol: number;
      accentVol?: number;
    };
    const next = {
      id,
      vol: vol !== undefined && Number.isFinite(vol) ? clampVolume(vol) : current.vol,
      accentVol:
        accentVol !== undefined && Number.isFinite(accentVol)
          ? clampVolume(accentVol)
          : (current.accentVol ?? 1),
    };
    this.update({ sounds: { ...this.stateSignal().sounds, [role]: next } });
  }

  setMasterVol(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.update({ masterVol: clampVolume(volume) });
  }

  private update(patch: Partial<MetronomeState>): void {
    this.stateSignal.update((state) => ({ ...state, ...patch }));
    this.persist();
  }

  private load(): MetronomeState {
    if (!this.storage) return DEFAULT_METRONOME_STATE;
    try {
      const raw = this.storage.getItem(METRONOME_STORAGE_KEY);
      if (!raw) return DEFAULT_METRONOME_STATE;
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed) && (parsed['version'] === 2 || parsed['version'] === 1))
        return readState(parsed);
      return DEFAULT_METRONOME_STATE;
    } catch {
      return DEFAULT_METRONOME_STATE;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: Persisted = { version: 2, state: this.stateSignal() };
    try {
      this.storage.setItem(METRONOME_STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }
}
