import { analyseBuffer } from './pitch-detection';

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
  silenceGate?: number;
  minFrequency?: number;
  trackedFrequency?: number | null;
  sessionId: number;
}

interface AnalyseResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  clarity?: number;
  candidateFrequency?: number | null;
  trackedFrequency?: number | null;
  trackedClarity?: number;
  analysisMs?: number;
  sessionId: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate, silenceGate, minFrequency, trackedFrequency, sessionId } = event.data;

  try {
    const startedAt = performance.now();
    const result = analyseBuffer(
      buffer,
      sampleRate,
      silenceGate,
      minFrequency,
      trackedFrequency ?? null,
    );
    const analysisMs = performance.now() - startedAt;
    self.postMessage({ ...result, analysisMs, sessionId } satisfies AnalyseResponse);
  } catch (err) {
    self.postMessage({
      frequency: null,
      confidence: 0,
      inputLevel: 0,
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    } satisfies AnalyseResponse);
  }
};
