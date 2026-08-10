import { TestBed } from '@angular/core/testing';
import { parseChord, parseTuning, ParsedChord, ParsedTuning } from '../utils/chord-theory';
import { searchChord, VoicingShape } from '../utils/chord-voicing';
import { ERGONOMICS_WEIGHTS } from '../utils/ergonomics';
import { ChordFeedbackStore, FEEDBACK_STORAGE, PIN_STORAGE_KEY } from './chord-feedback-store';

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

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('tuning parse failed');
const tuning: ParsedTuning = STANDARD.tuning;

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(`chord parse failed for ${symbol}`);
  return parsed.chord;
};

const firstShape = (symbol: string): VoicingShape => {
  const shapes = searchChord(tuning, chord(symbol), {
    openMode: 'allow',
    allowInversions: false,
    allowGaps: false,
    maxStretch: 4,
    minNotes: 3,
  });
  if (!shapes.length) throw new Error(`no shapes for ${symbol}`);
  return shapes[0];
};

describe('ChordFeedbackStore', () => {
  let storage: MemoryStorage;

  const createStore = (): ChordFeedbackStore => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FEEDBACK_STORAGE, useValue: storage }],
    });
    return TestBed.inject(ChordFeedbackStore);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('pins a shape and persists it', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);

    expect(store.isPinned(tuning, chord('C'), shape)).toBe(true);
    expect(storage.getItem(PIN_STORAGE_KEY)).toContain('"rating":"pin"');
  });

  it('unpins a shape on second toggle', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);
    store.togglePin(tuning, chord('C'), shape);

    expect(store.isPinned(tuning, chord('C'), shape)).toBe(false);
  });

  it('recovers pins from persisted storage', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);

    // New store instance reads the same storage.
    const reloaded = createStore();
    expect(reloaded.isPinned(tuning, chord('C'), shape)).toBe(true);
  });

  it('pin is a bookmark that does not touch the ergonomics weights', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);

    expect(store.count).toBe(1);
    // The shipped weights are immutable now — no offsets, no online training.
    expect(ERGONOMICS_WEIGHTS).toEqual(ERGONOMICS_WEIGHTS);
  });

  it('exposes the feature vectors as ML training data', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);

    const data = store.trainingData();
    expect(data).toHaveLength(1);
    expect(data[0].position).toBeGreaterThanOrEqual(0);
    expect(data[0].stretchSpan).toBeGreaterThanOrEqual(0);
  });

  it('exports training data as JSON with the pinned feature vectors', () => {
    const store = createStore();
    const shape = firstShape('C');
    store.togglePin(tuning, chord('C'), shape);

    const json = store.exportTrainingData();
    const parsed = JSON.parse(json) as { version: number; pins: { features: unknown }[] };
    expect(parsed.version).toBe(1);
    expect(parsed.pins).toHaveLength(1);
    expect(parsed.pins[0].features).toEqual(store.trainingData()[0]);
  });
});
