import {
  CaptureDiagnosticsTracker,
  DiagnosticFrame,
  describeMic,
  encodeSample,
  formatDiagnosticsReport,
  frameOutcome,
  levelToDecibels,
  sampleFileName,
} from './capture-diagnostics';
import { SILENCE_RMS } from './pitch-detection';

const frame = (overrides: Partial<DiagnosticFrame> = {}): DiagnosticFrame => ({
  inputLevel: 0.02,
  clarity: 0.9,
  candidateFrequency: 110,
  accepted: true,
  analysisMs: 2,
  receivedAt: 0,
  gate: SILENCE_RMS,
  noiseFloor: 0.001,
  ...overrides,
});

describe('frameOutcome', () => {
  it('separates detected, unclear and silent frames', () => {
    expect(frameOutcome(frame())).toBe('detected');
    expect(frameOutcome(frame({ accepted: false }))).toBe('unclear');
    expect(frameOutcome(frame({ accepted: false, inputLevel: SILENCE_RMS / 2 }))).toBe('silent');
  });

  it('judges silence against the gate that was active for that frame', () => {
    const quiet = { accepted: false, inputLevel: 0.001 };
    expect(frameOutcome(frame({ ...quiet, gate: 0.004 }))).toBe('silent');
    expect(frameOutcome(frame({ ...quiet, gate: 0.0005 }))).toBe('unclear');
  });
});

describe('levelToDecibels', () => {
  it('converts RMS to dBFS and treats zero as -Infinity', () => {
    expect(levelToDecibels(1)).toBe(0);
    expect(levelToDecibels(0.1)).toBeCloseTo(-20, 6);
    expect(levelToDecibels(0)).toBe(-Infinity);
  });
});

describe('CaptureDiagnosticsTracker', () => {
  it('starts empty', () => {
    const snapshot = new CaptureDiagnosticsTracker().snapshot();
    expect(snapshot.frames).toBe(0);
    expect(snapshot.last).toBeNull();
    expect(snapshot.averageAnalysisMs).toBeNull();
    expect(snapshot.analysesPerSecond).toBeNull();
  });

  it('aggregates outcomes, peak level, timing and analysis rate', () => {
    const tracker = new CaptureDiagnosticsTracker();
    tracker.record(frame({ receivedAt: 0, analysisMs: 2, inputLevel: 0.05 }));
    tracker.record(frame({ receivedAt: 50, analysisMs: 6, accepted: false }));
    tracker.record(frame({ receivedAt: 100, analysisMs: null, accepted: false, inputLevel: 0 }));

    const snapshot = tracker.snapshot();
    expect(snapshot.frames).toBe(3);
    expect(snapshot.outcomes).toEqual({ detected: 1, unclear: 1, silent: 1 });
    expect(snapshot.peakLevel).toBe(0.05);
    expect(snapshot.averageAnalysisMs).toBe(4);
    expect(snapshot.slowestAnalysisMs).toBe(6);
    expect(snapshot.analysesPerSecond).toBeCloseTo(20, 6);
    expect(snapshot.last?.outcome).toBe('silent');
  });

  it('keeps mic info but clears stats on reset', () => {
    const tracker = new CaptureDiagnosticsTracker();
    tracker.setMic(describeMic(undefined, 44100));
    tracker.record(frame());
    tracker.resetStats();

    const snapshot = tracker.snapshot();
    expect(snapshot.frames).toBe(0);
    expect(snapshot.peakLevel).toBe(0);
    expect(snapshot.mic?.contextSampleRate).toBe(44100);
  });
});

describe('describeMic', () => {
  it('falls back to unknowns when the track exposes no settings', () => {
    const mic = describeMic(undefined, 48000);
    expect(mic.channelCount).toBeNull();
    expect(mic.echoCancellation).toBeNull();
    expect(mic.trackSampleRate).toBeNull();
    expect(mic.label).toBe('');
  });

  it('ignores non-boolean echo cancellation modes', () => {
    const track = {
      label: 'Mic',
      getSettings: () => ({ echoCancellation: 'remote-only' }),
    } as unknown as MediaStreamTrack;
    expect(describeMic(track, 48000).echoCancellation).toBeNull();
  });
});

describe('formatDiagnosticsReport', () => {
  it('summarises mic settings and frame stats as plain text', () => {
    const tracker = new CaptureDiagnosticsTracker();
    tracker.setMic({
      label: 'iPhone Microphone',
      contextSampleRate: 48000,
      trackSampleRate: 48000,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: null,
      autoGainControl: null,
      supportedConstraints: ['echoCancellation'],
      userAgent: 'TestAgent',
    });
    tracker.record(frame({ receivedAt: 0 }));
    tracker.record(frame({ receivedAt: 45, accepted: false }));

    const report = formatDiagnosticsReport(tracker.snapshot());
    expect(report).toContain('Mic: iPhone Microphone');
    expect(report).toContain('Echo cancellation: false');
    expect(report).toContain('Noise suppression: unknown');
    expect(report).toContain('Detected: 50%');
    expect(report).toContain('Unclear (audible, no pitch): 50%');
    expect(report).toContain('Silence gate (adaptive): -48.0 dBFS');
    expect(report).toContain('Noise floor: -60.0 dBFS');
    expect(report).toContain('Search range: 27.0–1500 Hz');
    expect(report).toContain('Low cut: 20.0 Hz');
  });

  it('handles an empty session without dividing by zero', () => {
    const report = formatDiagnosticsReport(new CaptureDiagnosticsTracker().snapshot());
    expect(report).toContain('Detected: n/a');
    expect(report).toContain('Mic: n/a');
    expect(report).toContain('Supported constraints: none reported');
    expect(report).toContain('Noise floor: n/a');
  });
});

describe('encodeSample', () => {
  it('concatenates frames into one WAV with replay metadata', () => {
    const wav = encodeSample(
      {
        frames: [Float32Array.from([0.1, 0.2]), Float32Array.from([0.3, 0.4])],
        gates: [0.00123456, 0.002],
        sampleRate: 48000,
        frameSize: 2,
        hopMs: 45,
        range: { minFrequency: 49.4, highpassHz: 41.2 },
      },
      null,
    );
    const view = new DataView(wav);
    const listSize = view.getUint32(40, true);
    const commentSize = view.getUint32(52, true);
    const metadata = JSON.parse(
      new TextDecoder().decode(new Uint8Array(wav, 56, commentSize - 1)),
    ) as Record<string, unknown>;
    const dataOffset = 44 + listSize;

    expect(metadata).toMatchObject({ frameSize: 2, frameCount: 2, hopMs: 45, sampleRate: 48000 });
    expect(metadata['gates']).toEqual([0.001235, 0.002]);
    expect(metadata).toMatchObject({ minFrequency: 49.4, highpassHz: 41.2 });
    expect(view.getUint32(dataOffset + 4, true)).toBe(16);
    expect(view.getFloat32(dataOffset + 8 + 12, true)).toBeCloseTo(0.4, 6);
  });
});

describe('sampleFileName', () => {
  it('builds a filesystem-safe, sortable name', () => {
    expect(sampleFileName(new Date('2026-10-08T09:05:03.250Z'))).toBe(
      'omnituner-sample-2026-10-08_09-05-03.wav',
    );
  });
});
