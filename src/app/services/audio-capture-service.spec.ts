import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture-service';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  sessionId: number;
}

class MockWorker {
  static latest: MockWorker | null = null;

  onmessage: ((event: MessageEvent<PitchAnalysisResponse>) => void) | null = null;

  constructor() {
    MockWorker.latest = this;
  }

  postMessage(): void {}
  terminate(): void {}

  emit(response: PitchAnalysisResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<PitchAnalysisResponse>);
  }
}

describe('AudioCaptureService', () => {
  let service: AudioCaptureService;
  let worker: MockWorker;

  beforeEach(() => {
    MockWorker.latest = null;
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioCaptureService);
    worker = MockWorker.latest!;
    service.isCapturing.set(true);
    service.trackingState.set('listening');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('locks after three coherent, high-confidence frames', () => {
    worker.emit({ frequency: 109.9, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 110.1, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 110, confidence: 0.9, sessionId: 0 });

    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(110, 2);
  });

  it('does not lock onto inconsistent high-confidence readings', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 440, confidence: 0.9, sessionId: 0 });

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });

  it('holds a locked note through a single rejected frame before releasing it', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 146.9, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, sessionId: 0 });
    const lockedFrequency = service.frequency();

    worker.emit({ frequency: null, confidence: 0, sessionId: 0 });

    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBe(lockedFrequency);
  });

  it('releases a note after sustained rejected frames', () => {
    worker.emit({ frequency: 196, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 196.1, confidence: 0.9, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, sessionId: 0 });

    for (let frame = 0; frame < 8; frame++) {
      worker.emit({ frequency: null, confidence: 0, sessionId: 0 });
    }

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });
});
