import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture-service';

interface PitchAnalysisResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

const AUDIBLE = 0.02;

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
    vi.stubGlobal('Worker', MockWorker);
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioCaptureService);
    worker = MockWorker.latest!;
    service.isCapturing.set(true);
    service.trackingState.set('listening');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
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

  it('publishes a provisional frequency on the first accepted frame while still listening', () => {
    worker.emit({ frequency: 110, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeCloseTo(110, 2);

    worker.emit({ frequency: 110.1, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).not.toBeNull();

    worker.emit({ frequency: 110, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
  });

  it('holds a provisional frequency through a momentary dropout before locking', () => {
    worker.emit({ frequency: 110, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeCloseTo(110, 2);

    worker.emit({ frequency: null, confidence: 0, inputLevel: SILENT, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(110, 2);
  });

  it('keeps smoothing tightness constant in cents across the range', () => {
    const lock = (freq: number): void => {
      worker.emit({ frequency: freq, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
      worker.emit({ frequency: freq, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
      worker.emit({ frequency: freq, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    };
    const wobble = (base: number, cents: number): number => base * 2 ** (cents / 1200);
    const centsSpread = (base: number, samples: number[]): number => {
      const deviations = samples.map((f) => 1200 * Math.log2(f / base));
      return Math.max(...deviations) - Math.min(...deviations);
    };

    lock(82.41);
    expect(service.trackingState()).toBe('locked');
    const lowSamples: number[] = [];
    for (let i = 0; i < 12; i++) {
      const offset = i % 2 === 0 ? 3 : -3;
      worker.emit({
        frequency: wobble(82.41, offset),
        confidence: 0.9,
        inputLevel: AUDIBLE,
        sessionId: 0,
      });
      const f = service.frequency();
      if (f !== null) lowSamples.push(f);
    }

    lock(329.63);
    expect(service.trackingState()).toBe('locked');
    const highSamples: number[] = [];
    for (let i = 0; i < 12; i++) {
      const offset = i % 2 === 0 ? 3 : -3;
      worker.emit({
        frequency: wobble(329.63, offset),
        confidence: 0.9,
        inputLevel: AUDIBLE,
        sessionId: 0,
      });
      const f = service.frequency();
      if (f !== null) highSamples.push(f);
    }

    const lowSpread = centsSpread(82.41, lowSamples);
    const highSpread = centsSpread(329.63, highSamples);

    expect(lowSpread).toBeGreaterThan(0);
    expect(highSpread / lowSpread).toBeGreaterThan(0.6);
    expect(highSpread / lowSpread).toBeLessThan(1.4);
  });

  it('converges quickly on sustained pitch shifts (adaptive alpha)', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    const target = 146.8 * 2 ** (30 / 1200);
    worker.emit({ frequency: target, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: target, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    const freq = service.frequency();
    expect(freq).not.toBeNull();
    const progress = (freq! - 146.8) / (target - 146.8);
    expect(progress).toBeGreaterThan(0.35);
    expect(progress).toBeLessThan(0.6);
  });

  it('guards non-positive frequencies without losing the lock or producing NaN', () => {
    worker.emit({ frequency: 0, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeNull();

    for (let frame = 0; frame < 3; frame++) {
      worker.emit({ frequency: 110, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    }
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(110, 0);

    worker.emit({ frequency: -5, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).not.toBeNull();
    expect(Number.isNaN(service.frequency()!)).toBe(false);
    expect(service.frequency()!).toBeCloseTo(110, 0);
  });

  it('does not lock onto inconsistent high-confidence readings', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 440, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).not.toBeNull();
  });

  it('holds a locked note through momentary dropout frames before releasing it', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.9, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const lockedFrequency = service.frequency();

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

  it('releases atomically when the silent-hold budget is exhausted (no dead zone)', () => {
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196.1, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 196, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');

    for (let frame = 0; frame < 6; frame++) {
      worker.emit({ frequency: null, confidence: 0, inputLevel: SILENT, sessionId: 0 });
      expect(service.trackingState()).toBe('locked');
      expect(service.frequency()).not.toBeNull();
    }

    worker.emit({ frequency: null, confidence: 0, inputLevel: SILENT, sessionId: 0 });
    expect(service.trackingState()).toBe('listening');
    expect(service.frequency()).toBeNull();
  });

  it('holds the note through a long audible decay tail instead of blanking', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const lockedFrequency = service.frequency();
    expect(lockedFrequency).not.toBeNull();

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

    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(146.83, 1);
  });

  it('correctly transitions between notes across octaves without subharmonic corruption', () => {
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 82.4, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.trackingState()).toBe('locked');
    expect(service.frequency()).toBeCloseTo(82.4, 1);

    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.83, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });

    expect(service.trackingState()).toBe('locked');

    expect(service.frequency()).toBeCloseTo(146.83, 1);
  });

  it('rejects isolated outlier spike with median filter', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);

    worker.emit({ frequency: 152.0, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);
  });

  it('smooths sustained pitch changes with EMA filter', () => {
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 146.8, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    expect(service.frequency()).toBeCloseTo(146.8, 2);

    worker.emit({ frequency: 147.2, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    worker.emit({ frequency: 147.2, confidence: 0.9, inputLevel: AUDIBLE, sessionId: 0 });
    const freq = service.frequency();
    expect(freq).not.toBeNull();
    expect(freq!).toBeGreaterThan(146.8);
    expect(freq!).toBeLessThan(147.2);
  });
});
