import { TestBed } from '@angular/core/testing';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from '../utils/chord-theory';
import { searchChord } from '../utils/chord-voicing';
import { VoicingSearchMessage, VoicingSearchRequest } from '../utils/voicing-batch';
import { VOICING_WORKER_FACTORY, VoicingResults, VoicingSearch } from './voicing-search';

class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<VoicingSearchMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: VoicingSearchRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.created.push(this);
  }

  postMessage(request: VoicingSearchRequest): void {
    this.posted.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: VoicingSearchMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<VoicingSearchMessage>);
  }

  fail(): void {
    this.onerror?.(new ErrorEvent('error', { message: 'boom' }));
  }
}

const standard = (): ParsedTuning => {
  const parsed = parseTuning('E2 A2 D3 G3 B3 E4');
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tuning;
};

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.chord;
};

const setup = (factory: (() => Worker) | null): VoicingSearch => {
  TestBed.configureTestingModule({
    providers: [{ provide: VOICING_WORKER_FACTORY, useValue: factory }],
  });
  return TestBed.inject(VoicingSearch);
};

describe('VoicingSearch', () => {
  beforeEach(() => {
    FakeWorker.created = [];
  });

  describe('with a worker', () => {
    let search: VoicingSearch;
    const latest = (): FakeWorker => FakeWorker.created[FakeWorker.created.length - 1];

    beforeEach(() => {
      search = setup(() => new FakeWorker() as unknown as Worker);
    });

    it('posts the request to the worker and resolves with its shapes', async () => {
      const pending = search.search(standard(), [chord('C'), null], 6);
      const request = latest().posted[0];
      expect(request.chords).toHaveLength(2);
      expect(request.count).toBe(6);
      expect(search.progress()).toEqual({ done: 0, total: 2 });

      latest().emit({ kind: 'progress', runId: request.runId, done: 1, total: 2 });
      expect(search.progress()).toEqual({ done: 1, total: 2 });

      const shapes: VoicingResults = [[], []];
      latest().emit({ kind: 'result', runId: request.runId, shapes });
      await expect(pending).resolves.toBe(shapes);
      expect(search.progress()).toBeNull();
    });

    it('reuses one worker across finished runs', async () => {
      const first = search.search(standard(), [chord('C')], 6);
      latest().emit({ kind: 'result', runId: latest().posted[0].runId, shapes: [[]] });
      await first;

      void search.search(standard(), [chord('G')], 6);
      expect(FakeWorker.created).toHaveLength(1);
      expect(latest().posted).toHaveLength(2);
    });

    it('terminates a running search when a new one starts and drops its results', async () => {
      const first = search.search(standard(), [chord('C')], 6);
      const firstWorker = latest();
      const firstRunId = firstWorker.posted[0].runId;

      const second = search.search(standard(), [chord('G'), chord('D')], 6);
      const secondWorker = latest();

      expect(firstWorker.terminated).toBe(true);
      expect(secondWorker).not.toBe(firstWorker);
      await expect(first).resolves.toBeNull();
      expect(search.progress()).toEqual({ done: 0, total: 2 });

      firstWorker.emit({ kind: 'result', runId: firstRunId, shapes: [[]] });
      secondWorker.emit({ kind: 'progress', runId: firstRunId, done: 1, total: 1 });
      expect(search.progress()).toEqual({ done: 0, total: 2 });

      const shapes: VoicingResults = [[], []];
      secondWorker.emit({ kind: 'result', runId: secondWorker.posted[0].runId, shapes });
      await expect(second).resolves.toBe(shapes);
    });

    it('cancels a running search', async () => {
      const pending = search.search(standard(), [chord('C')], 6);
      search.cancel();
      expect(latest().terminated).toBe(true);
      expect(search.progress()).toBeNull();
      await expect(pending).resolves.toBeNull();
    });

    it('keeps the worker when cancelling with nothing running', () => {
      const first = search.search(standard(), [chord('C')], 6);
      latest().emit({ kind: 'result', runId: latest().posted[0].runId, shapes: [[]] });
      search.cancel();
      expect(latest().terminated).toBe(false);
      return first;
    });

    it('finishes the search on the main thread when the worker fails', async () => {
      const chords = [chord('C')];
      const pending = search.search(standard(), chords, 3);
      latest().fail();
      expect(latest().terminated).toBe(true);
      await expect(pending).resolves.toEqual([searchChord(standard(), chords[0], 3)]);

      await search.search(standard(), chords, 3);
      expect(FakeWorker.created).toHaveLength(1);
    });

    it('terminates the worker when destroyed', () => {
      void search.search(standard(), [chord('C')], 6);
      const worker = latest();
      TestBed.resetTestingModule();
      expect(worker.terminated).toBe(true);
    });
  });

  it('runs on the main thread when workers are unavailable', async () => {
    const search = setup(null);
    const chords = [chord('Am'), null];
    await expect(search.search(standard(), chords, 2)).resolves.toEqual([
      searchChord(standard(), chords[0]!, 2),
      [],
    ]);
    expect(search.progress()).toBeNull();
  });

  it('runs on the main thread when the worker cannot be created', async () => {
    const search = setup(() => {
      throw new Error('blocked');
    });
    await expect(search.search(standard(), [null], 2)).resolves.toEqual([[]]);
  });

  it('builds a real worker factory only when Worker exists', () => {
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const factory = TestBed.inject(VOICING_WORKER_FACTORY);
      expect(factory).toBeTypeOf('function');
      factory!();
      expect(FakeWorker.created).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
