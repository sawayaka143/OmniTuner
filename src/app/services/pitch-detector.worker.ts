/// <reference lib="webworker" />

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
  sessionId: number;
}

interface PitchEstimate {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
}

interface AnalyseResponse extends PitchEstimate {
  sessionId: number;
}

// ── Tuning constants ────────────────────────────────────────────────
// Lowered from 60 → 50 to catch detuned low strings (C2 ≈ 65 Hz,
// B1 ≈ 62 Hz). The main-thread highpass at 38 Hz handles rumble.
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 1200;

// Compromise between your 0.10 and File-1's 0.14.
// 0.12 still catches real notes but rejects more noise.
const YIN_THRESHOLD = 0.12;

// Raised from 0.68 → 0.72.  Your old value let too much garbage
// through, which then confused the main-thread smoothing.
const MIN_CONFIDENCE = 0.72;

const SILENCE_RMS = 0.004;

// Reusable buffer to avoid per-frame GC pressure.
let yinBuffer: Float64Array | null = null;
let yinBufferSize = 0;

// ── Entry point ─────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate, sessionId } = event.data;

  const inputLevel = computeRMS(buffer);
  if (inputLevel < SILENCE_RMS) {
    self.postMessage({
      frequency: null,
      confidence: 0,
      inputLevel,
      sessionId,
    } satisfies AnalyseResponse);
    return;
  }

  removeDCOffset(buffer);
  const result = yinDetect(buffer, sampleRate);

  self.postMessage({
    ...result,
    inputLevel,
    sessionId,
  } satisfies AnalyseResponse);
};

// ── DSP helpers ─────────────────────────────────────────────────────

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

// ── YIN core ────────────────────────────────────────────────────────

function yinDetect(buffer: Float32Array, sampleRate: number): PitchEstimate {
  const N = buffer.length;
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / MIN_FREQUENCY));

  if (maxLag <= minLag + 2) {
    return { frequency: null, confidence: 0, inputLevel: 0 };
  }

  // Reuse the CMNDF buffer across calls.
  if (!yinBuffer || yinBufferSize < maxLag + 1) {
    yinBufferSize = maxLag + 1;
    yinBuffer = new Float64Array(yinBufferSize);
  }
  const yin = yinBuffer;

  // Steps 1 & 2: difference function → CMNDF in one pass.
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

  // Step 3: absolute-threshold dip search.
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

  // Fallback: global minimum.
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

  // ── NEW: guitar fundamental preference ──────────────────────────
  // YIN frequently locks onto the 2nd harmonic (one octave up) on
  // guitar, especially the low E and A strings.  If the sub-octave
  // lag (tau * 2) has a clearly better CMNDF value, prefer it.
  tau = preferLowerFundamental(tau, yin, maxLag, sampleRate);

  // Step 4: parabolic interpolation for sub-sample accuracy.
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

function preferLowerFundamental(
  tau: number,
  yin: Float64Array,
  maxLag: number,
  sampleRate: number,
): number {
  const frequency = sampleRate / tau;
  if (frequency < 180) return tau;          // already in the bass range

  const candidateTau = tau * 2;
  if (candidateTau > maxLag) return tau;    // can't go lower

  const candidateValue = yin[candidateTau];
  const currentValue = yin[tau];

  // Only switch if the sub-octave is *clearly* better.
  if (candidateValue + 0.018 < currentValue) {
    return candidateTau;
  }

  return tau;
}