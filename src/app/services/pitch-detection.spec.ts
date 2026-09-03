import {
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  analyseBuffer,
  preferLowerFundamental,
} from './pitch-detection';

const SAMPLE_RATE = 48000;
const BUFFER_LENGTH = 8192;

function centsBetween(detected: number, expected: number): number {
  return Math.abs(1200 * Math.log2(detected / expected));
}

interface Partial {
  freq: number;
  amp: number;
}

function synthesize(partials: Partial[]): Float32Array {
  const buffer = new Float32Array(BUFFER_LENGTH);
  for (let i = 0; i < BUFFER_LENGTH; i++) {
    let sample = 0;
    for (const { freq, amp } of partials) {
      sample += amp * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
    }
    buffer[i] = sample;
  }
  return buffer;
}

function noise(seed: number, amplitude = 0.5): Float32Array {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  const buffer = new Float32Array(BUFFER_LENGTH);
  for (let i = 0; i < BUFFER_LENGTH; i++) {
    buffer[i] = next() * amplitude;
  }
  return buffer;
}

function expectFrequency(buffer: Float32Array, expected: number, toleranceCents = 10): void {
  const result = analyseBuffer(buffer, SAMPLE_RATE);
  expect(result.frequency).not.toBeNull();
  expect(centsBetween(result.frequency as number, expected)).toBeLessThanOrEqual(toleranceCents);
}

function makeYin(maxLag: number, dips: Record<number, number>): Float64Array {
  const yin = new Float64Array(maxLag + 1).fill(1);
  for (const [lag, value] of Object.entries(dips)) {
    yin[Number(lag)] = value;
  }
  return yin;
}

describe('pitch-detection constants', () => {
  it('covers bass low B through 24th-fret high-E bends', () => {
    expect(MIN_FREQUENCY).toBe(27);
    expect(MAX_FREQUENCY).toBe(1500);
  });
});

describe('analyseBuffer', () => {
  it('detects pure sines across the full range, including both edges', () => {
    expectFrequency(synthesize([{ freq: 30.87, amp: 1 }]), 30.87);
    expectFrequency(synthesize([{ freq: 82.41, amp: 1 }]), 82.41);
    expectFrequency(synthesize([{ freq: 110, amp: 1 }]), 110);
    expectFrequency(synthesize([{ freq: 146.83, amp: 1 }]), 146.83);
    expectFrequency(synthesize([{ freq: 329.63, amp: 1 }]), 329.63);
    expectFrequency(synthesize([{ freq: 1318.51, amp: 1 }]), 1318.51);
  });

  it('reports the RMS input level alongside the detected pitch', () => {
    const result = analyseBuffer(synthesize([{ freq: 82.41, amp: 0.5 }]), SAMPLE_RATE);
    expect(result.inputLevel).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(result.frequency).toBeCloseTo(82.41, 0);
  });

  it('returns null below the silence gate', () => {
    const result = analyseBuffer(new Float32Array(BUFFER_LENGTH), SAMPLE_RATE);
    expect(result).toEqual({ frequency: null, confidence: 0, inputLevel: 0 });
  });

  it('returns null for a DC-only buffer after offset removal', () => {
    const dc = new Float32Array(BUFFER_LENGTH).fill(0.5);
    const result = analyseBuffer(dc, SAMPLE_RATE);
    expect(result.frequency).toBeNull();
    expect(result.inputLevel).toBeCloseTo(0.5, 2);
  });

  it('returns null for aperiodic noise', () => {
    const result = analyseBuffer(noise(1234), SAMPLE_RATE);
    expect(result.frequency).toBeNull();
  });

  it('keeps a pure second harmonic uncorrected (nothing to correct)', () => {
    expectFrequency(synthesize([{ freq: 164.81, amp: 1 }]), 164.81);
  });

  it('corrects a second-harmonic mislock back to the weak fundamental', () => {
    expectFrequency(
      synthesize([
        { freq: 82.41, amp: 0.1 },
        { freq: 164.81, amp: 1 },
      ]),
      82.41,
    );
  });

  it('corrects a third-harmonic mislock back to the weak fundamental', () => {
    // A1 with a dominant 3rd harmonic: the mislocked 165 Hz reading sits inside
    // the iterative guard band, so the x3 descent can correct it to 55 Hz.
    expectFrequency(
      synthesize([
        { freq: 55, amp: 0.1 },
        { freq: 165, amp: 1 },
      ]),
      55,
    );
  });

  it('keeps a fundamental-dominant low E at its true octave', () => {
    expectFrequency(
      synthesize([
        { freq: 82.41, amp: 1 },
        { freq: 164.81, amp: 0.5 },
        { freq: 247.23, amp: 0.33 },
        { freq: 329.63, amp: 0.25 },
      ]),
      82.41,
    );
  });

  it('preserves legacy single-step behavior above the guard band', () => {
    expectFrequency(
      synthesize([
        { freq: 220, amp: 0.1 },
        { freq: 440, amp: 1 },
      ]),
      440,
    );
  });
});

describe('preferLowerFundamental (iterative band, below 180 Hz)', () => {
  it('descends one octave when the doubled lag is a clearly better dip', () => {
    const yin = makeYin(1300, { 300: 0.2, 600: 0.05 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(600);
  });

  it('skips a non-improving doubled lag and descends via the tripled lag', () => {
    const yin = makeYin(1300, { 300: 0.2, 600: 0.19, 900: 0.02 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(900);
  });

  it('chains descents across passes down to the true fundamental', () => {
    const yin = makeYin(1300, { 300: 0.9, 600: 0.4, 1200: 0.05 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(1200);
  });

  it('stops when the current dip is already near-perfect', () => {
    const yin = makeYin(1300, { 300: 0.002, 600: 0.0001 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(300);
  });

  it('refuses a candidate that is not clearly better', () => {
    const yin = makeYin(1300, { 300: 0.2, 600: 0.15 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(300);
  });

  it('refuses a candidate dip above the ceiling', () => {
    const yin = makeYin(1300, { 300: 1, 600: 0.4 });
    expect(preferLowerFundamental(300, yin, 1300, SAMPLE_RATE)).toBe(300);
  });

  it('bails when the candidate lag exceeds the search range', () => {
    const yin = makeYin(500, { 300: 0.2, 600: 0.05 });
    expect(preferLowerFundamental(300, yin, 500, SAMPLE_RATE)).toBe(300);
  });
});

describe('preferLowerFundamental (legacy band, 180 Hz and above)', () => {
  it('applies the single-step margin check', () => {
    const yin = makeYin(1300, { 100: 0.1, 200: 0.04 });
    expect(preferLowerFundamental(100, yin, 1300, SAMPLE_RATE)).toBe(200);

    const shallow = makeYin(1300, { 100: 0.1, 200: 0.06 });
    expect(preferLowerFundamental(100, shallow, 1300, SAMPLE_RATE)).toBe(100);
  });
});
