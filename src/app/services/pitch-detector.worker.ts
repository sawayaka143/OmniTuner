import { analyseBuffer } from './pitch-detection';

interface AnalyseRequest {
  buffer: Float32Array;
  sampleRate: number;
  sessionId: number;
}

interface AnalyseResponse {
  frequency: number | null;
  confidence: number;
  inputLevel: number;
  sessionId: number;
}

self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { buffer, sampleRate, sessionId } = event.data;

  try {
    const result = analyseBuffer(buffer, sampleRate);
    self.postMessage({ ...result, sessionId } satisfies AnalyseResponse);
  } catch (err) {
    console.error('[PitchDetectorWorker] analysis failed:', err);
    self.postMessage({
      frequency: null,
      confidence: 0,
      inputLevel: 0,
      sessionId,
    } satisfies AnalyseResponse);
  }
};
