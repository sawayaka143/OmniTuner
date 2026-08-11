import { inject, InjectionToken, signal, Service } from '@angular/core';
import { ParsedChord, ParsedTuning } from '../utils/chord-theory';
import { VoicingShape } from '../utils/chord-voicing';
import { ErgonomicsFeatures, ergonomicsFeatures } from '../utils/ergonomics';

export const FEEDBACK_STORAGE_KEY = 'omnituner.chord-feedback.v1';
export const PIN_STORAGE_KEY = 'omnituner.chord-pins.v1';

export const FEEDBACK_STORAGE = new InjectionToken<Storage | null>('Chord feedback storage', {
  factory: () => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  },
});

export interface VoicingFeedback {
  readonly key: string;
  readonly tuning: string;
  readonly chord: string;
  readonly frets: string;
  /** Feature vector of the shape at pin time. */
  readonly features: ErgonomicsFeatures;
  readonly rating: 'pin';
  readonly at: number;
}

interface PersistedFeedback {
  readonly version: 1;
  readonly entries: readonly VoicingFeedback[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseEntries = (value: unknown): readonly VoicingFeedback[] => {
  if (!Array.isArray(value)) return [];
  const result: VoicingFeedback[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry['key'] !== 'string' ||
      typeof entry['tuning'] !== 'string' ||
      typeof entry['chord'] !== 'string' ||
      typeof entry['frets'] !== 'string' ||
      !isRecord(entry['features']) ||
      entry['rating'] !== 'pin' ||
      typeof entry['at'] !== 'number'
    ) {
      continue;
    }
    result.push({
      key: entry['key'],
      tuning: entry['tuning'],
      chord: entry['chord'],
      frets: entry['frets'],
      features: entry['features'] as unknown as ErgonomicsFeatures,
      rating: 'pin',
      at: entry['at'],
    });
  }
  return result;
};

/** Persistent store for chord-finder pins; never mutates the shipped ergonomics weights. */
@Service()
export class ChordFeedbackStore {
  private readonly storage = inject(FEEDBACK_STORAGE);

  private readonly pinsSignal = signal<readonly VoicingFeedback[]>(this.load().entries);

  readonly pins = this.pinsSignal.asReadonly();

  private load(): PersistedFeedback {
    if (!this.storage) return { version: 1, entries: [] };
    try {
      const raw = this.storage.getItem(PIN_STORAGE_KEY);
      if (!raw) return { version: 1, entries: [] };
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || parsed['version'] !== 1) return { version: 1, entries: [] };
      return { version: 1, entries: parseEntries(parsed['entries']) };
    } catch {
      return { version: 1, entries: [] };
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const value: PersistedFeedback = { version: 1, entries: this.pinsSignal() };
    try {
      this.storage.setItem(PIN_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable/full — session state remains usable.
    }
  }

  private key(tuning: ParsedTuning, chord: ParsedChord, frets: readonly (number | null)[]): string {
    return `${tuning.labels.join(' ')}|${chord.symbol}|${frets.map((f) => (f === null ? 'x' : f)).join(',')}`;
  }

  isPinned(tuning: ParsedTuning, chord: ParsedChord, shape: VoicingShape): boolean {
    const key = this.key(tuning, chord, shape.frets);
    return this.pinsSignal().some((e) => e.key === key);
  }

  get count(): number {
    return this.pinsSignal().length;
  }

  trainingData(): readonly ErgonomicsFeatures[] {
    return this.pinsSignal().map((e) => e.features);
  }

  togglePin(tuning: ParsedTuning, chord: ParsedChord, shape: VoicingShape): void {
    const key = this.key(tuning, chord, shape.frets);
    const exists = this.pinsSignal().some((e) => e.key === key);
    if (exists) {
      this.pinsSignal.update((list) => list.filter((e) => e.key !== key));
      this.persist();
      return;
    }
    const entry: VoicingFeedback = {
      key,
      tuning: tuning.labels.join(' '),
      chord: chord.symbol,
      frets: shape.frets.join(','),
      features: ergonomicsFeatures(shape, tuning, chord),
      rating: 'pin',
      at: Date.now(),
    };
    this.pinsSignal.update((list) => [...list, entry]);
    this.persist();
  }
}
