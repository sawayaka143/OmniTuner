/// <reference lib="webworker" />

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
  sessionId: number;
}

interface PitchEstimate {
  frequency: number | null;
  confidence: number;
}

interface AnalyseResponse extends PitchEstimate {
  sessionId: number;
}

const SILENCE_RMS = 0.005;
const MIN_FREQUENCY = 60;    // Below a detuned guitar's lowest string, above common fan rumble
const MAX_FREQUENCY = 1200; // ~D6 note
const YIN_THRESHOLD = 0.1;  // absolute threshold for the CMNDF dip search (paper suggests 0.10-0.15)
const MIN_CONFIDENCE = 0.68; // Reject weakly periodic noise before it reaches the display

// Reusable buffer to minimize garbage collection in real-time processing
let yinBuffer: Float64Array | null = null;
let yinBufferSize = 0;

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate, sessionId } = event.data;

  const rms = computeRMS(buffer);
  if (rms < SILENCE_RMS) {
    self.postMessage({ frequency: null, confidence: 0, sessionId } as AnalyseResponse);
    return;
  }

  const result = yinDetect(buffer, sampleRate);
  self.postMessage({ ...result, sessionId } as AnalyseResponse);
};

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function yinDetect(buffer: Float32Array, sampleRate: number): PitchEstimate {
  const N = buffer.length;

  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY));
  // Ensure maxLag doesn't exceed half the buffer to maintain a sufficient integration window
  const maxLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / MIN_FREQUENCY));

  if (maxLag <= minLag + 2) {
    return { frequency: null, confidence: 0 };
  }

  // Reuse buffer if possible to prevent GC pauses
  if (!yinBuffer || yinBufferSize < maxLag + 1) {
    yinBufferSize = maxLag + 1;
    yinBuffer = new Float64Array(yinBufferSize);
  }
  const yin = yinBuffer!;

  // Step 1 & 2: Difference function and CMNDF
  // Calculate difference function directly into CMNDF array with running sum
  const W = N - maxLag; // Fixed integration window size to prevent shrinking bias
  yin[0] = 1;
  let runningSum = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    runningSum += sum;
    // Prevent NaN if runningSum is 0 (perfect silence), though RMS check should catch it
    yin[lag] = runningSum > 0 ? (sum * lag) / runningSum : 1;
  }

  // Step 3: Absolute threshold
  let tau = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (yin[lag] < YIN_THRESHOLD) {
      // Walk forward to find the minimum of this dip
      while (lag + 1 <= maxLag && yin[lag + 1] < yin[lag]) {
        lag++;
      }
      tau = lag;
      break;
    }
  }

  // Fallback to global minimum if no dip below threshold is found
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
    return { frequency: null, confidence: 0 };
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  let refinedTau = tau;
  if (tau > 0 && tau < maxLag) {
    const y0 = yin[tau - 1];
    const y1 = yin[tau];
    const y2 = yin[tau + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom !== 0) {
      const shift = (0.5 * (y0 - y2)) / denom;
      // Clamp shift to [-1, 1] to prevent wild jumps on noisy signals
      refinedTau = tau + Math.max(-1, Math.min(1, shift));
    }
  }

  if (refinedTau <= 0) {
    return { frequency: null, confidence: 0 };
  }

  const frequency = sampleRate / refinedTau;
  const confidence = Math.max(0, 1 - yin[tau]);

  if (confidence < MIN_CONFIDENCE) {
    return { frequency: null, confidence: 0 };
  }

  return { frequency, confidence };
}