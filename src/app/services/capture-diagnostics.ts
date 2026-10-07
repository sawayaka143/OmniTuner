import { encodeFloatWav } from '../utils/wav';
import { DetectionRange, MAX_FREQUENCY, detectionRangeFor } from './pitch-detection';

export interface RecordedSample {
  readonly frames: readonly Float32Array[];
  readonly gates: readonly number[];
  readonly sampleRate: number;
  readonly frameSize: number;
  readonly hopMs: number;
  readonly range: DetectionRange;
}

export type FrameOutcome = 'silent' | 'unclear' | 'detected';

export interface DiagnosticFrame {
  readonly inputLevel: number;
  readonly clarity: number | null;
  readonly candidateFrequency: number | null;
  readonly accepted: boolean;
  readonly analysisMs: number | null;
  readonly receivedAt: number;
  readonly gate: number;
  readonly noiseFloor: number | null;
}

export interface MicDiagnostics {
  readonly label: string;
  readonly contextSampleRate: number;
  readonly trackSampleRate: number | null;
  readonly channelCount: number | null;
  readonly echoCancellation: boolean | null;
  readonly noiseSuppression: boolean | null;
  readonly autoGainControl: boolean | null;
  readonly supportedConstraints: readonly string[];
  readonly userAgent: string;
}

export interface CaptureDiagnostics {
  readonly mic: MicDiagnostics | null;
  readonly range: DetectionRange;
  readonly last: (DiagnosticFrame & { readonly outcome: FrameOutcome }) | null;
  readonly frames: number;
  readonly outcomes: Readonly<Record<FrameOutcome, number>>;
  readonly peakLevel: number;
  readonly averageAnalysisMs: number | null;
  readonly slowestAnalysisMs: number | null;
  readonly analysesPerSecond: number | null;
}

const REPORTED_CONSTRAINTS = [
  'echoCancellation',
  'noiseSuppression',
  'autoGainControl',
  'voiceIsolation',
  'channelCount',
  'sampleRate',
] as const;

const RATE_SMOOTHING = 0.1;

export function frameOutcome(frame: DiagnosticFrame): FrameOutcome {
  if (frame.accepted) return 'detected';
  return frame.inputLevel < frame.gate ? 'silent' : 'unclear';
}

export function levelToDecibels(level: number): number {
  return level > 0 ? 20 * Math.log10(level) : -Infinity;
}

export function describeMic(
  track: MediaStreamTrack | undefined,
  contextSampleRate: number,
): MicDiagnostics {
  const settings: MediaTrackSettings = track?.getSettings?.() ?? {};
  const supported: Partial<Record<string, boolean>> = {
    ...navigator.mediaDevices?.getSupportedConstraints?.(),
  };

  return {
    label: track?.label ?? '',
    contextSampleRate,
    trackSampleRate: settings.sampleRate ?? null,
    channelCount: settings.channelCount ?? null,
    echoCancellation: booleanSetting(settings.echoCancellation),
    noiseSuppression: settings.noiseSuppression ?? null,
    autoGainControl: settings.autoGainControl ?? null,
    supportedConstraints: REPORTED_CONSTRAINTS.filter((name) => supported[name] === true),
    userAgent: navigator.userAgent,
  };
}

function booleanSetting(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export class CaptureDiagnosticsTracker {
  private mic: MicDiagnostics | null = null;
  private range: DetectionRange = detectionRangeFor(null);
  private last: CaptureDiagnostics['last'] = null;
  private frames = 0;
  private outcomes: Record<FrameOutcome, number> = { silent: 0, unclear: 0, detected: 0 };
  private peakLevel = 0;
  private analysisTotalMs = 0;
  private timedFrames = 0;
  private slowestAnalysisMs: number | null = null;
  private smoothedIntervalMs: number | null = null;

  setMic(mic: MicDiagnostics | null): void {
    this.mic = mic;
  }

  setRange(range: DetectionRange): void {
    this.range = range;
  }

  record(frame: DiagnosticFrame): void {
    const outcome = frameOutcome(frame);

    if (this.last !== null) {
      const interval = frame.receivedAt - this.last.receivedAt;
      if (interval > 0) {
        this.smoothedIntervalMs =
          this.smoothedIntervalMs === null
            ? interval
            : this.smoothedIntervalMs + RATE_SMOOTHING * (interval - this.smoothedIntervalMs);
      }
    }

    this.last = { ...frame, outcome };
    this.frames += 1;
    this.outcomes = { ...this.outcomes, [outcome]: this.outcomes[outcome] + 1 };
    this.peakLevel = Math.max(this.peakLevel, frame.inputLevel);

    if (frame.analysisMs !== null) {
      this.analysisTotalMs += frame.analysisMs;
      this.timedFrames += 1;
      this.slowestAnalysisMs = Math.max(this.slowestAnalysisMs ?? 0, frame.analysisMs);
    }
  }

  resetStats(): void {
    this.last = null;
    this.frames = 0;
    this.outcomes = { silent: 0, unclear: 0, detected: 0 };
    this.peakLevel = 0;
    this.analysisTotalMs = 0;
    this.timedFrames = 0;
    this.slowestAnalysisMs = null;
    this.smoothedIntervalMs = null;
  }

  snapshot(): CaptureDiagnostics {
    return {
      mic: this.mic,
      range: this.range,
      last: this.last,
      frames: this.frames,
      outcomes: this.outcomes,
      peakLevel: this.peakLevel,
      averageAnalysisMs: this.timedFrames > 0 ? this.analysisTotalMs / this.timedFrames : null,
      slowestAnalysisMs: this.slowestAnalysisMs,
      analysesPerSecond: this.smoothedIntervalMs ? 1000 / this.smoothedIntervalMs : null,
    };
  }
}

export function formatDiagnosticsReport(diagnostics: CaptureDiagnostics): string {
  const { mic, frames, outcomes } = diagnostics;
  const percent = (count: number): string =>
    frames > 0 ? `${Math.round((count / frames) * 100)}%` : 'n/a';
  const flag = (value: boolean | null): string => (value === null ? 'unknown' : String(value));
  const ms = (value: number | null): string => (value === null ? 'n/a' : `${value.toFixed(1)} ms`);
  const db = (value: number | null | undefined): string =>
    value == null ? 'n/a' : `${levelToDecibels(value).toFixed(1)} dBFS`;

  return [
    'OmniTuner diagnostics',
    `Device: ${mic?.userAgent ?? 'n/a'}`,
    `Mic: ${mic?.label || 'n/a'}`,
    `Context sample rate: ${mic?.contextSampleRate ?? 'n/a'} Hz`,
    `Track sample rate: ${mic?.trackSampleRate ?? 'unknown'} Hz`,
    `Channels: ${mic?.channelCount ?? 'unknown'}`,
    `Echo cancellation: ${flag(mic?.echoCancellation ?? null)}`,
    `Noise suppression: ${flag(mic?.noiseSuppression ?? null)}`,
    `Auto gain: ${flag(mic?.autoGainControl ?? null)}`,
    `Supported constraints: ${mic?.supportedConstraints.join(', ') || 'none reported'}`,
    `Search range: ${diagnostics.range.minFrequency.toFixed(1)}–${MAX_FREQUENCY} Hz`,
    `Low cut: ${diagnostics.range.highpassHz.toFixed(1)} Hz`,
    `Frames: ${frames}`,
    `Detected: ${percent(outcomes.detected)}`,
    `Unclear (audible, no pitch): ${percent(outcomes.unclear)}`,
    `Below silence gate: ${percent(outcomes.silent)}`,
    `Peak level: ${levelToDecibels(diagnostics.peakLevel).toFixed(1)} dBFS`,
    `Noise floor: ${db(diagnostics.last?.noiseFloor)}`,
    `Silence gate (adaptive): ${db(diagnostics.last?.gate)}`,
    `Analysis time: avg ${ms(diagnostics.averageAnalysisMs)}, max ${ms(diagnostics.slowestAnalysisMs)}`,
    `Analyses per second: ${diagnostics.analysesPerSecond?.toFixed(1) ?? 'n/a'}`,
  ].join('\n');
}

export function encodeSample(sample: RecordedSample, mic: MicDiagnostics | null): ArrayBuffer {
  const samples = new Float32Array(sample.frames.length * sample.frameSize);
  sample.frames.forEach((frame, index) => samples.set(frame, index * sample.frameSize));

  const metadata = {
    app: 'OmniTuner',
    layout: 'concatenated analysis frames',
    frameSize: sample.frameSize,
    frameCount: sample.frames.length,
    hopMs: sample.hopMs,
    sampleRate: sample.sampleRate,
    gates: sample.gates.map((gate) => Number(gate.toPrecision(4))),
    minFrequency: sample.range.minFrequency,
    highpassHz: sample.range.highpassHz,
    mic,
  };
  return encodeFloatWav(samples, sample.sampleRate, JSON.stringify(metadata));
}

export function sampleFileName(date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `omnituner-sample-${stamp}.wav`;
}
