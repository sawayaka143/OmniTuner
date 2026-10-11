import { differenceFunction } from './yin-difference';

export interface PitchEstimate {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  clarity?: number;
  candidateFrequency?: number | null;
  trackedFrequency?: number | null;
  trackedClarity?: number;
}

export const MIN_FREQUENCY = 27;
export const MAX_FREQUENCY = 1500;

export const YIN_THRESHOLD = 0.15;

export const MIN_CONFIDENCE = 0.58;

export const SILENCE_RMS = 0.004;

export const DIP_MARGIN = 0.05;

export const TRACKED_LAG_TOLERANCE = 0.03;

export const DEFAULT_HIGHPASS_HZ = 20;
export const DETECTION_FLOOR_RATIO = 0.6;
export const HIGHPASS_RATIO = 0.5;

export interface DetectionRange {
  readonly minFrequency: number;
  readonly highpassHz: number;
}

export function detectionRangeFor(lowestNoteHz: number | null): DetectionRange {
  if (lowestNoteHz === null || !Number.isFinite(lowestNoteHz) || lowestNoteHz <= 0) {
    return { minFrequency: MIN_FREQUENCY, highpassHz: DEFAULT_HIGHPASS_HZ };
  }
  return {
    minFrequency: Math.max(MIN_FREQUENCY, lowestNoteHz * DETECTION_FLOOR_RATIO),
    highpassHz: Math.max(DEFAULT_HIGHPASS_HZ, lowestNoteHz * HIGHPASS_RATIO),
  };
}

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

export function analyseBuffer(
  buffer: Float32Array,
  sampleRate: number,
  silenceGate = SILENCE_RMS,
  minFrequency = MIN_FREQUENCY,
  trackedFrequency: number | null = null,
): PitchEstimate {
  const inputLevel = computeRMS(buffer);
  if (inputLevel < silenceGate) {
    return { frequency: null, confidence: 0, inputLevel };
  }

  removeDCOffset(buffer);
  const result = yinDetect(
    buffer,
    sampleRate,
    Math.max(MIN_FREQUENCY, minFrequency),
    trackedFrequency,
  );
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

function yinDetect(
  buffer: Float32Array,
  sampleRate: number,
  minFrequency: number,
  trackedFrequency: number | null,
): PitchEstimate {
  const N = buffer.length;
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / minFrequency));

  if (maxLag <= minLag + 2) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  if (!yinBuffer || yinBufferSize < maxLag + 1) {
    yinBufferSize = maxLag + 1;
    yinBuffer = new Float64Array(yinBufferSize);
  }
  const yin = yinBuffer;

  differenceFunction(buffer, maxLag, yin);
  yin[0] = 1;
  let runningSum = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    const sum = yin[lag];
    runningSum += sum;
    yin[lag] = runningSum > 0 ? (sum * lag) / runningSum : 1;
  }

  const tracked =
    trackedFrequency !== null && Number.isFinite(trackedFrequency) && trackedFrequency > 0
      ? estimateNearLag(yin, sampleRate / trackedFrequency, minLag, maxLag, sampleRate)
      : {};
  return { ...pickFundamental(yin, minLag, maxLag, sampleRate), ...tracked };
}

export function estimateNearLag(
  yin: Float64Array,
  lag: number,
  minLag: number,
  maxLag: number,
  sampleRate: number,
): { trackedFrequency: number | null; trackedClarity: number } {
  const low = Math.max(minLag + 1, Math.floor(lag * (1 - TRACKED_LAG_TOLERANCE)));
  const high = Math.min(maxLag - 1, Math.ceil(lag * (1 + TRACKED_LAG_TOLERANCE)));
  if (high - low < 2) return { trackedFrequency: null, trackedClarity: 0 };

  let best = low;
  for (let candidate = low + 1; candidate <= high; candidate++) {
    if (yin[candidate] < yin[best]) best = candidate;
  }
  if (best === low || best === high) return { trackedFrequency: null, trackedClarity: 0 };

  return {
    trackedFrequency: sampleRate / refineLag(yin, best),
    trackedClarity: Math.max(0, 1 - yin[best]),
  };
}

function refineLag(yin: Float64Array, tau: number): number {
  const y0 = yin[tau - 1];
  const y1 = yin[tau];
  const y2 = yin[tau + 1];
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return tau;
  const shift = (0.5 * (y0 - y2)) / denom;
  return tau + Math.max(-1, Math.min(1, shift));
}

function pickFundamental(
  yin: Float64Array,
  minLag: number,
  maxLag: number,
  sampleRate: number,
): PitchEstimate {
  let deepestDip = Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    deepestDip = Math.min(deepestDip, yin[lag]);
  }
  let tau = firstDipBelow(yin, Math.max(YIN_THRESHOLD, deepestDip + DIP_MARGIN), minLag, maxLag);

  if (tau <= 0) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  tau = preferLowerFundamental(tau, yin, maxLag, sampleRate);

  const refinedTau = tau > 0 && tau < maxLag ? refineLag(yin, tau) : tau;

  if (refinedTau <= 0) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  const frequency = sampleRate / refinedTau;
  const confidence = Math.max(0, 1 - yin[tau]);

  if (confidence < MIN_CONFIDENCE) {
    return {
      frequency: null,
      confidence: 0,
      inputLevel: 0,
      clarity: confidence,
      candidateFrequency: frequency,
    };
  }

  return {
    frequency,
    confidence,
    inputLevel: 0,
    clarity: confidence,
    candidateFrequency: frequency,
  };
}

export function firstDipBelow(
  yin: Float64Array,
  threshold: number,
  minLag: number,
  maxLag: number,
): number {
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (yin[lag] < threshold) {
      while (lag + 1 <= maxLag && yin[lag + 1] < yin[lag]) {
        lag++;
      }
      return lag;
    }
  }
  return -1;
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
