/// <reference lib="webworker" />

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
}

interface AnalyseResponse {
  frequency: number | null;
  confidence: number;
}

// --- Constants for tuning ---
const SILENCE_RMS = 0.005;
const MIN_FREQUENCY = 30;   // ~B1 note
const MAX_FREQUENCY = 1200; // ~D6 note
const MIN_CONFIDENCE = 0.3;

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate } = event.data;

  const rms = computeRMS(buffer);
  if (rms < SILENCE_RMS) {
    self.postMessage({ frequency: null, confidence: 0 });
    return;
  }

  const result = autoCorrelate(buffer, sampleRate);
  self.postMessage(result);
};

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number
): AnalyseResponse {
  const N = buffer.length;

  // A minimum buffer size is required for meaningful autocorrelation 
  // and to prevent edge cases with the Hann window.
  if (N < 4) {
    return { frequency: null, confidence: 0 };
  }

  // Use Float64Array for DSP math to prevent precision loss and phase drift
  const windowed = new Float64Array(N);
  let zeroLagEnergy = 0;

  for (let i = 0; i < N; i++) {
    // Standard Hann window
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = buffer[i] * w;
    zeroLagEnergy += windowed[i] * windowed[i];
  }

  if (zeroLagEnergy === 0) {
    return { frequency: null, confidence: 0 };
  }

  // Calculate lag boundaries based on frequencies we care about
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxSearchLag = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / MIN_FREQUENCY));
  
  // We only need to calculate up to maxSearchLag + 1 for parabolic interpolation
  const maxCalcLag = maxSearchLag + 1;
  const correlations = new Float64Array(maxCalcLag + 1);

  // Lag 0 is always perfectly correlated (1.0)
  correlations[0] = 1.0;

  // Calculate normalized autocorrelation
  for (let lag = 1; lag <= maxCalcLag; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += windowed[i] * windowed[i + lag];
    }
    
    // Biased estimator: Divides by the total zero-lag energy.
    // This bounds the result strictly to [-1, 1] and creates a smoother 
    // decay curve, which makes parabolic interpolation highly accurate.
    correlations[lag] = sum / zeroLagEnergy;
  }

  let bestLag = -1;
  let bestCorr = 0;

  // Find the absolute maximum peak in our valid frequency range
  for (let lag = minLag; lag <= maxSearchLag; lag++) {
    if (
      correlations[lag] > correlations[lag - 1] &&
      correlations[lag] > correlations[lag + 1] &&
      correlations[lag] > bestCorr
    ) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }
  }

  // If no valid peak found or confidence is too low
  if (bestLag === -1 || bestCorr < MIN_CONFIDENCE) {
    return { frequency: null, confidence: 0 };
  }

  // --- Parabolic Interpolation for sub-sample accuracy ---
  const y0 = correlations[bestLag - 1];
  const y1 = correlations[bestLag];
  const y2 = correlations[bestLag + 1];

  const denom = y0 - 2 * y1 + y2;
  let shift = 0;

  if (denom !== 0) {
    // Standard formula for the x-offset of a parabola's vertex given 3 points
    shift = 0.5 * (y0 - y2) / denom;
  }

  const refinedLag = bestLag + shift;
  const frequency = sampleRate / refinedLag;

  // bestCorr is naturally bounded between [-1, 1], no need to clamp
  return { frequency, confidence: bestCorr };
}