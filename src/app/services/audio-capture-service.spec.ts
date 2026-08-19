import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture-service';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

/** Audible signal level, above the worker's silence gate. */
const AUDIBLE = 0.02;
/** Below the silence gate (0.004): true silence. */
const SILENT = 0.001;

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
    worker.emit({ frequency: 109.9, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 110.1, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 110, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(110, 2);
  });

  it('does not lock onto inconsistent high-confidence readings', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 440, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });

  it('holds a locked note through momentary dropout frames before releasing it', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.9, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const lockedFrequency = service.frequency();

    // 5 dropped frames should still hold the display
    for (let frame = 0; frame < 5; frame++) {
      worker.emit({ frequency: null, confidence: 0, inputLevel: SILENT, sessionId: 0 });
      expect(service.trackingState()).toBe('locked');
      expect(service.frequency()).toBe(lockedFrequency);
    }
  });

  it('releases a note after sustained true silence', () => {
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196.1, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    for (let frame = 0; frame < 10; frame++) {
      worker.emit({ frequency: null, confidence: 0, inputLevel: SILENT, sessionId: 0 });
    }

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });

  it('holds the note through a long audible decay tail instead of blanking', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const lockedFrequency = service.frequency();
    expect(lockedFrequency).not.toBeNull();

    // String still ringing but confidence gone: 40 untrusted audible
    // frames (~1.8 s) must keep the last good pitch on screen.
    for (let frame = 0; frame < 40; frame++) {
      worker.emit({ frequency: null, confidence: 0, inputLevel: AUDIBLE, sessionId: 0 });
      expect(service.trackingState()).toBe('locked');
      expect(service.frequency()).toBe(lockedFrequency);
    }
  });

  it('eventually releases when audible input never yields a trusted pitch', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');

    for (let frame = 0; frame < 60; frame++) {
      worker.emit({ frequency: null, confidence: 0, inputLevel: AUDIBLE, sessionId: 0 });
    }
    expect(service.trackingState()).toBe('locked');

    worker.emit({ frequency: null, confidence: 0, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });

  it('ignores a single octave-slip frame while locked', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    // One confident sub-octave error must not move the needle.
    worker.emit({ frequency: 41.2, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(82.4, 1);
  });

  it('commits to a new note only after two coherent far frames', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    // First D3 frame: far from E2, unconfirmed → display must not flicker.
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    // Second coherent D3 frame: confirmed note change → lock D3.
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(146.83, 1);
  });

  it('correctly transitions between notes across octaves without subharmonic corruption', () => {
    // Pluck low E2 (~82.4 Hz)
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    // Pluck D3 (~146.83 Hz) immediately
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('locked');
    // Must lock to D3 (~146.83 Hz), NOT D2 (~73.4 Hz)
    expect(service.frequency()).toBeCloseTo(146.83, 1);
  });

  it('rejects isolated outlier spike with median filter', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);

    // Single outlier spike is rejected by median filter
    worker.emit({ frequency: 152.0, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);
  });

  it('smooths sustained pitch changes with EMA filter', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);

    // Sustained slight shift over consecutive frames
    worker.emit({ frequency: 147.2, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 147.2, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const freq = service.frequency();
    expect(freq).not.toBeNull();
    expect(freq!).toBeGreaterThan(146.8);
    expect(freq!).toBeLessThan(147.2);
  });
});
