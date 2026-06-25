/// <reference lib="webworker" />

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
}

interface AnalyseResponse {
  frequency: number | null;
  confidence: number;
}

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate } = event.data;

  const rms = computeRMS(buffer);
  if (rms < 0.005) {
    self.postMessage({ frequency: null, confidence: 0 });
    return;
  }

  const result = autoCorrelate(buffer, sampleRate);
  self.postMessage(result);
};

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number
): { frequency: number | null; confidence: number } {
  const N = buffer.length;

  const windowed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = buffer[i] * w;
  }

  const maxLag = Math.floor(N / 2);
  const correlations = new Float32Array(maxLag);

  let zeroLagEnergy = 0;
  for (let i = 0; i < N; i++) zeroLagEnergy += windowed[i] * windowed[i];
  if (zeroLagEnergy === 0) return { frequency: null, confidence: 0 };

  for (let lag = 0; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += windowed[i] * windowed[i + lag];
    }
    correlations[lag] = sum / zeroLagEnergy;
  }

  const minLag = Math.max(1, Math.ceil(sampleRate / 1200));
  const maxSearchLag = Math.min(maxLag, Math.ceil(sampleRate / 60));

  let bestLag = -1;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag < maxSearchLag; lag++) {
    if (
      correlations[lag] > correlations[lag - 1] &&
      correlations[lag] > correlations[lag + 1] &&
      correlations[lag] > bestCorr
    ) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 0.3) {
    return { frequency: null, confidence: 0 };
  }

  const y0 = correlations[bestLag - 1];
  const y1 = correlations[bestLag];
  const y2 = correlations[bestLag + 1];
  const a = (y0 + y2 - 2 * y1) / 2;
  let refinedLag = bestLag;
  if (a !== 0) {
    refinedLag = bestLag - (y2 - y0) / (4 * a);
  }

  const frequency = sampleRate / refinedLag;
  if (frequency < 20 || frequency > 4000) {
    return { frequency: null, confidence: 0 };
  }

  const confidence = Math.min(1, bestCorr);

  return { frequency, confidence };
}