import { analyseBuffer } from './pitch-detection';

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
  silenceGate?: number;
  minFrequency?: number;
  sessionId: number;
}

interface AnalyseResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  clarity?: number;
  candidateFrequency?: number | null;
  analysisMs?: number;
  sessionId: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate, silenceGate, minFrequency, sessionId } = event.data;

  try {
    const startedAt = performance.now();
    const result = analyseBuffer(buffer, sampleRate, silenceGate, minFrequency);
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
