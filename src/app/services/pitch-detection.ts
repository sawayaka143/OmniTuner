export interface PitchEstimate {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
}

export const MIN_FREQUENCY = 27;
export const MAX_FREQUENCY = 1500;

export const YIN_THRESHOLD = 0.15;

export const MIN_CONFIDENCE = 0.58;

export const SILENCE_RMS = 0.004;

// Sub-harmonic guard (preferLowerFundamental): above this frequency the legacy
// single-step x2 check applies unchanged; below it an iterative descent runs.
const GUARD_BAND_LOWER_HZ = 180;
// Legacy band: candidate dip must beat the current one by this absolute margin.
const LEGACY_SUBHARMONIC_MARGIN = 0.05;
// Iterative band: descend only when the current lock is imperfect (dip above the
// floor) and the longer period is a real dip (<= ceiling) that aligns at least
// this much better than the current one. Ratio-based because phase error grows
// with lag, so an absolute margin can never be met when both dips are small.
// The floor stops over-correction past the true fundamental once alignment is
// near-perfect: a near-zero dip means the detected period IS the signal period.
const SUBHARMONIC_RATIO = 0.5;
const SUBHARMONIC_CEILING = 0.3;
const SUBHARMONIC_ALIGNMENT_FLOOR = 0.005;
const SUBHARMONIC_MULTIPLES = [2, 3, 4] as const;

export function analyseBuffer(buffer: Float32Array, sampleRate: number): PitchEstimate {
  const inputLevel = computeRMS(buffer);
  if (inputLevel < SILENCE_RMS) {
    return { frequency: null, confidence: 0, inputLevel };
  }

  removeDCOffset(buffer);
  const result = yinDetect(buffer, sampleRate);
  return { ...result, inputLevel };
}

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function removeDCOffset(buffer: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const mean = sum / buffer.length;
  if (Math.abs(mean) < 0.0001) return;
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] -= mean;
  }
}

let yinBuffer: Float64Array | null = null;
let yinBufferSize = 0;

function yinDetect(buffer: Float32Array, sampleRate: number): PitchEstimate {
  const N = buffer.length;
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / MIN_FREQUENCY));

  if (maxLag <= minLag + 2) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  if (!yinBuffer || yinBufferSize < maxLag + 1) {
    yinBufferSize = maxLag + 1;
    yinBuffer = new Float64Array(yinBufferSize);
  }
  const yin = yinBuffer;

  const W = N - maxLag;
  yin[0] = 1;
  let runningSum = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    runningSum += sum;
    yin[lag] = runningSum > 0 ? (sum * lag) / runningSum : 1;
  }

  let tau = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (yin[lag] < YIN_THRESHOLD) {
      while (lag + 1 <= maxLag && yin[lag + 1] < yin[lag]) {
        lag++;
      }
      tau = lag;
      break;
    }
  }

  if (tau === -1) {
    let minVal = Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (yin[lag] < minVal) {
        minVal = yin[lag];
        tau = lag;
      }
    }
  }

  if (tau <= 0) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  tau = preferLowerFundamental(tau, yin, maxLag, sampleRate);

  let refinedTau: number = tau;
  if (tau > 0 && tau < maxLag) {
    const y0 = yin[tau - 1];
    const y1 = yin[tau];
    const y2 = yin[tau + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom !== 0) {
      const shift = (0.5 * (y0 - y2)) / denom;
      refinedTau = tau + Math.max(-1, Math.min(1, shift));
    }
  }

  if (refinedTau <= 0) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  const frequency = sampleRate / refinedTau;
  const confidence = Math.max(0, 1 - yin[tau]);

  if (confidence < MIN_CONFIDENCE) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  return { frequency, confidence, inputLevel: 0 };
}

export function preferLowerFundamental(
  tau: number,
  yin: Float64Array,
  maxLag: number,
  sampleRate: number,
): number {
  const frequency = sampleRate / tau;
  if (frequency >= GUARD_BAND_LOWER_HZ) {
    return singleStepSubharmonic(tau, yin, maxLag);
  }
  return iterativeSubharmonicDescent(tau, yin, maxLag);
}

function singleStepSubharmonic(tau: number, yin: Float64Array, maxLag: number): number {
  const candidateTau = tau * 2;
  if (candidateTau > maxLag) return tau;

  const candidateValue = yin[candidateTau];
  const currentValue = yin[tau];

  if (candidateValue + LEGACY_SUBHARMONIC_MARGIN < currentValue) {
    return candidateTau;
  }

  return tau;
}

function iterativeSubharmonicDescent(tau: number, yin: Float64Array, maxLag: number): number {
  let current = tau;
  let descended = true;

  while (descended) {
    descended = false;
    for (const multiple of SUBHARMONIC_MULTIPLES) {
      const candidate = current * multiple;
      if (candidate > maxLag) continue;

      const candidateValue = yin[candidate];
      const currentValue = yin[current];

      if (
        currentValue > SUBHARMONIC_ALIGNMENT_FLOOR &&
        candidateValue <= SUBHARMONIC_CEILING &&
        candidateValue <= SUBHARMONIC_RATIO * currentValue
      ) {
        current = candidate;
        descended = true;
        break;
      }
    }
  }

  return current;
}
