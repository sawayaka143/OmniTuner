import { inject, InjectionToken, Service, signal } from '@angular/core';
import {
  DEFAULT_TUNER_SETTINGS,
  InTunePreferences,
  REFERENCE_PITCH_MAX,
  REFERENCE_PITCH_MIN,
  TUNER_HOLD_MAX,
  TUNER_HOLD_MIN,
  TUNER_TOLERANCE_MAX,
  TUNER_TOLERANCE_MIN,
  TunerMode,
  TunerSettings,
  TunerStartupMode,
} from '../models/tuner-preferences.model';

export const TUNER_PREFERENCES_STORAGE_KEY = 'omnituner.tuner-preferences.v1';
export const TUNER_PREFERENCES_VERSION = 3;

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
  readonly tuner?: TunerSettings;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const isTunerMode = (value: unknown): value is TunerMode => value === 'auto' || value === 'manual';

const isStartupMode = (value: unknown): value is TunerStartupMode =>
  value === 'remember' || isTunerMode(value);

const clampTolerance = (value: number): number =>
  Math.min(TUNER_TOLERANCE_MAX, Math.max(TUNER_TOLERANCE_MIN, Math.round(value)));

const clampHoldMs = (value: number): number =>
  Math.min(TUNER_HOLD_MAX, Math.max(TUNER_HOLD_MIN, Math.round(value)));

const clampReferencePitch = (value: number): number =>
  Math.min(REFERENCE_PITCH_MAX, Math.max(REFERENCE_PITCH_MIN, Math.round(value)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readTunerSettings = (value: unknown): TunerSettings => {
  if (!isRecord(value) || !isRecord(value['tuner'])) {
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
  const referencePitch =
    typeof tuner['referencePitch'] === 'number' && Number.isFinite(tuner['referencePitch'])
      ? clampReferencePitch(tuner['referencePitch'])
      : defaults.referencePitch;

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
    referencePitch,
  };
};

@Service()
export class TunerPreferences {
  private readonly storage = inject(TUNER_PREFERENCES_STORAGE);
  private readonly tunerSettingsSignal = signal<TunerSettings>(this.load());

  readonly tunerSettings = this.tunerSettingsSignal.asReadonly();

  setMode(mode: TunerMode): void {
    if (!isTunerMode(mode)) return;
    this.updateTuner({ mode });
  }

  setStartupMode(startupMode: TunerStartupMode): void {
    if (!isStartupMode(startupMode)) return;
    this.updateTuner({ startupMode });
  }

  setReferencePitch(referencePitch: number): void {
    if (!Number.isFinite(referencePitch)) return;
    this.updateTuner({ referencePitch: clampReferencePitch(referencePitch) });
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

  private load(): TunerSettings {
    if (!this.storage) return DEFAULT_TUNER_SETTINGS;
    try {
      const raw = this.storage.getItem(TUNER_PREFERENCES_STORAGE_KEY);
      if (!raw) return DEFAULT_TUNER_SETTINGS;
      return readTunerSettings(JSON.parse(raw) as unknown);
    } catch {
      return DEFAULT_TUNER_SETTINGS;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: PersistedTunerPreferences = {
      version: TUNER_PREFERENCES_VERSION,
      tuner: this.tunerSettingsSignal(),
    };
    try {
      this.storage.setItem(TUNER_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable or full; current-session state remains usable.
    }
  }
}
