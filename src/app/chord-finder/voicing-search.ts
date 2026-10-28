import { DestroyRef, inject, InjectionToken, Service, signal } from '@angular/core';
import { ParsedChord, ParsedTuning } from '../utils/chord-theory';
import { VoicingShape } from '../utils/chord-voicing';
import {
  runVoicingSearch,
  VoicingSearchMessage,
  VoicingSearchRequest,
} from '../utils/voicing-batch';

export interface VoicingSearchProgress {
  readonly done: number;
  readonly total: number;
}

export type VoicingResults = readonly (readonly VoicingShape[])[];

export const VOICING_WORKER_FACTORY = new InjectionToken<(() => Worker) | null>(
  'Voicing search worker factory',
  {
    factory: () =>
      typeof Worker === 'undefined'
        ? null
        : () => new Worker(new URL('./voicing-search.worker', import.meta.url)),
  },
);

interface ActiveRun {
  readonly request: VoicingSearchRequest;
  readonly resolve: (shapes: VoicingResults | null) => void;
}

@Service()
export class VoicingSearch {
  private readonly createWorker = inject(VOICING_WORKER_FACTORY);
  private worker: Worker | null = null;
  private workerFailed = false;
  private runId = 0;
  private active: ActiveRun | null = null;

  readonly progress = signal<VoicingSearchProgress | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
      this.worker?.terminate();
      this.worker = null;
    });
  }

  search(
    tuning: ParsedTuning,
    chords: readonly (ParsedChord | null)[],
    count: number,
  ): Promise<VoicingResults | null> {
    this.cancel();
    const request: VoicingSearchRequest = { runId: ++this.runId, tuning, chords, count };
    this.progress.set({ done: 0, total: chords.length });
    return new Promise((resolve) => {
      this.active = { request, resolve };
      const worker = this.ensureWorker();
      if (worker) worker.postMessage(request);
      else this.runInline(request);
    });
  }

  cancel(): void {
    if (!this.active) return;
    this.worker?.terminate();
    this.worker = null;
    this.settle(null);
  }

  private ensureWorker(): Worker | null {
    if (this.worker || this.workerFailed || !this.createWorker) return this.worker;
    try {
      const worker = this.createWorker();
      worker.onmessage = (event: MessageEvent<VoicingSearchMessage>) => this.handle(event.data);
      worker.onerror = (event: ErrorEvent) => this.handleWorkerError(event);
      this.worker = worker;
    } catch {
      this.workerFailed = true;
    }
    return this.worker;
  }

  private handleWorkerError(event: ErrorEvent): void {
    event.preventDefault();
    this.worker?.terminate();
    this.worker = null;
    this.workerFailed = true;
    if (this.active) this.runInline(this.active.request);
  }

  private runInline(request: VoicingSearchRequest): void {
    runVoicingSearch(request, (message) => this.handle(message));
  }

  private handle(message: VoicingSearchMessage): void {
    if (!this.active || message.runId !== this.active.request.runId) return;
    if (message.kind === 'progress') {
      this.progress.set({ done: message.done, total: message.total });
    } else {
      this.settle(message.shapes);
    }
  }

  private settle(shapes: VoicingResults | null): void {
    const run = this.active;
    this.active = null;
    this.progress.set(null);
    run?.resolve(shapes);
  }
}
