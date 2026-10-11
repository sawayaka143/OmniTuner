import {
  AUDIBLE_HOLD_FRAMES,
  HARMONIC_JUMP_FRAMES,
  MAX_DROPOUT_HOLD_FRAMES,
  PitchTracker,
  TRACK_CONTINUE_CLARITY,
  TrackerFrame,
  TrackerOutput,
  harmonicRatioOf,
} from './pitch-tracker';

const GATE = 0.004;
const LEVEL = 0.02;

const pitched = (frequency: number, extra: Partial<TrackerFrame> = {}): TrackerFrame => ({
  frequency,
  confidence: 0.9,
  inputLevel: LEVEL,
  gate: GATE,
  ...extra,
});

const unclear = (extra: Partial<TrackerFrame> = {}): TrackerFrame => ({
  frequency: null,
  confidence: 0,
  inputLevel: LEVEL,
  gate: GATE,
  ...extra,
});

const silent = (): TrackerFrame => ({
  frequency: null,
  confidence: 0,
  inputLevel: 0.001,
  gate: GATE,
});

function lock(tracker: PitchTracker, frequency: number): TrackerOutput {
  tracker.update(pitched(frequency));
  tracker.update(pitched(frequency));
  return tracker.update(pitched(frequency));
}

describe('PitchTracker', () => {
  let tracker: PitchTracker;

  beforeEach(() => {
    tracker = new PitchTracker();
  });

  it('starts listening with nothing to track', () => {
    expect(tracker.trackedFrequency).toBeNull();
    expect(tracker.update(silent())).toEqual({
      frequency: null,
      state: 'listening',
      pitched: false,
    });
  });

  it('shows a provisional pitch and locks after three coherent frames', () => {
    expect(tracker.update(pitched(110))).toMatchObject({ state: 'listening', pitched: true });
    expect(tracker.trackedFrequency).toBeNull();
    tracker.update(pitched(110));
    const output = tracker.update(pitched(110));

    expect(output.state).toBe('locked');
    expect(output.frequency).toBeCloseTo(110, 5);
    expect(tracker.trackedFrequency).toBeCloseTo(110, 5);
  });

  it('treats a non-positive or non-finite reading as a dropout', () => {
    lock(tracker, 110);

    expect(tracker.update(pitched(0)).state).toBe('holding');
    expect(tracker.update(pitched(Number.NaN)).state).toBe('holding');
    expect(tracker.update(pitched(110)).state).toBe('locked');
  });

  describe('holding', () => {
    it('holds a locked note through silence, then releases it', () => {
      const locked = lock(tracker, 196).frequency;

      for (let frame = 0; frame < MAX_DROPOUT_HOLD_FRAMES; frame++) {
        expect(tracker.update(silent())).toEqual({
          frequency: locked,
          state: 'holding',
          pitched: false,
        });
      }

      expect(tracker.update(silent())).toEqual({
        frequency: null,
        state: 'listening',
        pitched: false,
      });
      expect(tracker.trackedFrequency).toBeNull();
    });

    it('holds longer while the input stays audible, but not indefinitely', () => {
      lock(tracker, 146.8);

      for (let frame = 0; frame < AUDIBLE_HOLD_FRAMES; frame++) {
        expect(tracker.update(unclear()).state).toBe('holding');
      }
      expect(tracker.update(unclear()).frequency).toBeNull();
    });

    it('keeps a provisional pitch listening, not holding, before it locks', () => {
      tracker.update(pitched(110));
      expect(tracker.update(silent())).toMatchObject({
        frequency: expect.closeTo(110, 5),
        state: 'listening',
      });
    });
  });

  describe('tracked-note continuation', () => {
    it('follows a fading note the detector rejects while its period is still clear', () => {
      lock(tracker, 110);

      const output = tracker.update(
        unclear({ trackedFrequency: 109.8, trackedClarity: TRACK_CONTINUE_CLARITY + 0.05 }),
      );

      expect(output).toMatchObject({ state: 'locked', pitched: true });
    });

    it('stops following once the tracked period becomes unclear', () => {
      lock(tracker, 110);

      const output = tracker.update(
        unclear({ trackedFrequency: 109.8, trackedClarity: TRACK_CONTINUE_CLARITY - 0.05 }),
      );

      expect(output.state).toBe('holding');
    });

    it('overrules an octave-down slip while the tracked note is still present', () => {
      lock(tracker, 146.9);

      for (let frame = 0; frame < 10; frame++) {
        const output = tracker.update(
          pitched(73.3, { trackedFrequency: 146.7, trackedClarity: 0.6 }),
        );
        expect(output.state).toBe('locked');
        expect(output.frequency).toBeGreaterThan(146);
      }
    });

    it('prefers the detector when it agrees with the tracked note', () => {
      lock(tracker, 110);
      tracker.update(pitched(110.5, { trackedFrequency: 109, trackedClarity: 0.9 }));
      tracker.update(pitched(110.5, { trackedFrequency: 109, trackedClarity: 0.9 }));
      const output = tracker.update(pitched(110.5, { trackedFrequency: 109, trackedClarity: 0.9 }));

      expect(output.frequency).toBeGreaterThan(110);
    });

    it('ignores the tracked note right after a new pluck', () => {
      lock(tracker, 246.94);
      tracker.update(silent());

      const outputs = Array.from({ length: HARMONIC_JUMP_FRAMES }, () =>
        tracker.update(pitched(82.41, { trackedFrequency: 246.9, trackedClarity: 0.9 })),
      );

      expect(outputs.at(-1)!.frequency).toBeCloseTo(82.41, 1);
    });

    it('ignores tracked measurements before a note is locked', () => {
      tracker.update(pitched(110));
      const output = tracker.update(unclear({ trackedFrequency: 110, trackedClarity: 0.9 }));

      expect(output).toMatchObject({ state: 'listening', pitched: false });
    });
  });

  describe('note changes', () => {
    it('switches to an unrelated note after two coherent frames', () => {
      lock(tracker, 82.41);

      expect(tracker.update(pitched(146.83)).frequency).toBeCloseTo(82.41, 1);
      expect(tracker.update(pitched(146.83)).frequency).toBeCloseTo(146.83, 1);
    });

    it('needs an extra coherent frame before switching by an octave', () => {
      lock(tracker, 110);

      for (let frame = 1; frame < HARMONIC_JUMP_FRAMES; frame++) {
        expect(tracker.update(pitched(220)).frequency).toBeCloseTo(110, 1);
      }
      expect(tracker.update(pitched(220)).frequency).toBeCloseTo(220, 1);
    });

    it('never shows the second-harmonic flash at the start of a pluck', () => {
      lock(tracker, 110);
      const shown = [441.1, 440.7, 219.9, 219.7, 219.8].map(
        (frequency) => tracker.update(pitched(frequency)).frequency!,
      );

      expect(Math.max(...shown)).toBeLessThan(300);
      expect(shown.at(-1)).toBeCloseTo(219.8, 1);
    });

    it('ignores a single isolated octave frame', () => {
      lock(tracker, 82.4);

      expect(tracker.update(pitched(41.2)).frequency).toBeCloseTo(82.4, 1);
      expect(tracker.update(pitched(82.4)).frequency).toBeCloseTo(82.4, 1);
    });
  });

  describe('responsiveness', () => {
    const centsFrom = (frequency: number, reference: number): number =>
      1200 * Math.log2(frequency / reference);

    it('settles within 1 cent of a 15 cent peg turn in at most eight frames', () => {
      lock(tracker, 82.41);
      const target = 82.41 * 2 ** (-15 / 1200);

      let frames = 0;
      let shown = 82.41;
      while (Math.abs(centsFrom(shown, target)) > 1 && frames < 30) {
        shown = tracker.update(pitched(target)).frequency!;
        frames++;
      }

      expect(frames).toBeLessThanOrEqual(8);
    });

    it('keeps 2 cent frame-to-frame noise within about a cent on screen', () => {
      lock(tracker, 196);
      const noise = [2, -1.5, 0.5, -2, 1.8, -0.4, 1.1, -1.9, 0.2, 1.6, -1.2, 0.9];
      const shown = noise.map((offset) =>
        centsFrom(tracker.update(pitched(196 * 2 ** (offset / 1200))).frequency!, 196),
      );

      expect(Math.max(...shown) - Math.min(...shown)).toBeLessThan(2);
    });
  });

  it('forgets everything on reset', () => {
    lock(tracker, 110);
    tracker.reset();

    expect(tracker.trackedFrequency).toBeNull();
    expect(tracker.update(silent()).frequency).toBeNull();
  });
});

describe('harmonicRatioOf', () => {
  it('recognises octave, twelfth and double-octave intervals', () => {
    expect(harmonicRatioOf(1200)).toBe(2);
    expect(harmonicRatioOf(1902)).toBe(3);
    expect(harmonicRatioOf(2400)).toBe(4);
    expect(harmonicRatioOf(1230)).toBe(2);
  });

  it('rejects intervals that are not low harmonics', () => {
    expect(harmonicRatioOf(700)).toBeNull();
    expect(harmonicRatioOf(1000)).toBeNull();
    expect(harmonicRatioOf(1260)).toBeNull();
  });
});
