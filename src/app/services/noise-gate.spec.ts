import {
  AdaptiveNoiseGate,
  FLOOR_RISE_DB_PER_FRAME,
  GATE_MARGIN_DB,
  MAX_GATE_DB,
  MIN_GATE_DB,
} from './noise-gate';
import { SILENCE_RMS } from './pitch-detection';

const fromDb = (db: number): number => 10 ** (db / 20);
const toDb = (level: number): number => 20 * Math.log10(level);

describe('AdaptiveNoiseGate', () => {
  it('uses the fixed silence gate until it has heard anything', () => {
    const gate = new AdaptiveNoiseGate();
    expect(gate.gate).toBe(SILENCE_RMS);
    expect(gate.noiseFloor).toBeNull();
  });

  it('opens a few dB above a quiet room', () => {
    const gate = new AdaptiveNoiseGate();
    for (let i = 0; i < 20; i++) gate.update(fromDb(-62), false);

    expect(toDb(gate.noiseFloor!)).toBeCloseTo(-62, 6);
    expect(toDb(gate.gate)).toBeCloseTo(-62 + GATE_MARGIN_DB, 6);
  });

  it('never drops below the minimum gate, even in digital silence', () => {
    const gate = new AdaptiveNoiseGate();
    for (let i = 0; i < 50; i++) gate.update(0, false);

    expect(toDb(gate.gate)).toBeCloseTo(MIN_GATE_DB, 6);
  });

  it('never gets stricter than the original fixed gate in a loud room', () => {
    const gate = new AdaptiveNoiseGate();
    for (let i = 0; i < 20; i++) gate.update(fromDb(-35), false);

    expect(toDb(gate.gate)).toBeCloseTo(MAX_GATE_DB, 6);
  });

  it('rises slowly on unpitched sound and holds still while a note rings', () => {
    const gate = new AdaptiveNoiseGate();
    gate.update(fromDb(-65), false);

    for (let i = 0; i < 10; i++) gate.update(fromDb(-30), true);
    expect(toDb(gate.noiseFloor!)).toBeCloseTo(-65, 6);

    gate.update(fromDb(-30), false);
    expect(toDb(gate.noiseFloor!)).toBeCloseTo(-65 + FLOOR_RISE_DB_PER_FRAME, 6);
  });

  it('follows a quieter room down quickly but not instantly', () => {
    const gate = new AdaptiveNoiseGate();
    gate.update(fromDb(-50), false);
    gate.update(fromDb(-70), false);

    const afterOne = toDb(gate.noiseFloor!);
    expect(afterOne).toBeLessThan(-50);
    expect(afterOne).toBeGreaterThan(-70);

    for (let i = 0; i < 30; i++) gate.update(fromDb(-70), false);
    expect(toDb(gate.noiseFloor!)).toBeCloseTo(-70, 1);
  });

  it('forgets the room on reset', () => {
    const gate = new AdaptiveNoiseGate();
    gate.update(fromDb(-60), false);
    gate.reset();
    expect(gate.gate).toBe(SILENCE_RMS);
  });
});
