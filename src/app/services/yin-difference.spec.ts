import { differenceFunction } from './yin-difference';

function bruteForce(buffer: Float32Array, maxLag: number): Float64Array {
  const window = buffer.length - maxLag;
  const out = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    out[lag] = sum;
  }
  return out;
}

function seededBuffer(length: number, seed: number): Float32Array {
  let state = seed;
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const noise = (state >>> 0) / 4294967296 - 0.5;
    buffer[i] = 0.6 * Math.sin((2 * Math.PI * 82.41 * i) / 48000) + 0.1 * noise;
  }
  return buffer;
}

function expectMatchesBruteForce(buffer: Float32Array, maxLag: number): void {
  const expected = bruteForce(buffer, maxLag);
  const actual = new Float64Array(maxLag + 1);
  differenceFunction(buffer, maxLag, actual);

  const scale = Math.max(...expected);
  for (let lag = 0; lag <= maxLag; lag++) {
    expect(Math.abs(actual[lag] - expected[lag]) / scale).toBeLessThan(1e-9);
  }
}

describe('differenceFunction', () => {
  it('matches the direct O(N·W) sum for a full tuner-sized buffer', () => {
    expectMatchesBruteForce(seededBuffer(8192, 7), Math.ceil(48000 / 27));
  });

  it('matches for buffer lengths that are not powers of two', () => {
    expectMatchesBruteForce(seededBuffer(3000, 11), 700);
  });

  it('is zero at lag 0 and never negative', () => {
    const out = new Float64Array(401);
    differenceFunction(seededBuffer(2048, 3), 400, out);
    expect(out[0]).toBeCloseTo(0, 9);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
  });

  it('gives consistent results when the workspace is reused across sizes', () => {
    const small = seededBuffer(1024, 5);
    const large = seededBuffer(8192, 9);
    const first = new Float64Array(201);
    const again = new Float64Array(201);

    differenceFunction(small, 200, first);
    differenceFunction(large, 1500, new Float64Array(1501));
    differenceFunction(small, 200, again);

    expect(Array.from(again)).toEqual(Array.from(first));
  });
});
