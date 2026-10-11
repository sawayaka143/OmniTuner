export type PitchTrackingState = 'idle' | 'listening' | 'locked' | 'holding';

export interface TrackerFrame {
  readonly frequency: number | null;
  readonly confidence: number;
  readonly inputLevel: number;
  readonly gate: number;
  readonly trackedFrequency?: number | null;
  readonly trackedClarity?: number;
}

export interface TrackerOutput {
  readonly frequency: number | null;
  readonly state: Exclude<PitchTrackingState, 'idle'>;
  readonly pitched: boolean;
}

const SMOOTHING_WINDOW = 3;
const EMA_ALPHA = 0.25;
const MAX_SMOOTHING_JUMP_CENTS = 380;
const ADAPTIVE_ALPHA_CENTS = 20;

export const MAX_DROPOUT_HOLD_FRAMES = 6;
export const AUDIBLE_HOLD_FRAMES = 22;

export const TRACK_CONTINUE_CLARITY = 0.45;
const HARMONIC_RATIOS = [2, 3, 4] as const;
const HARMONIC_TOLERANCE_CENTS = 40;
const NOTE_CHANGE_FRAMES = 2;
export const HARMONIC_JUMP_FRAMES = 3;

const ONSET_RISE_DB = 3;
const ONSET_FRAMES = 3;

const IDLE_OUTPUT: TrackerOutput = { frequency: null, state: 'listening', pitched: false };

export class PitchTracker {
  private recentLogFreqs: number[] = [];
  private smoothedFrequency: number | null = null;
  private emaLogFreq: number | null = null;
  private missedFrames = 0;
  private pendingLogFreq: number | null = null;
  private pendingFrames = 0;
  private previousLevel: number | null = null;
  private onsetFramesLeft = 0;

  get trackedFrequency(): number | null {
    if (this.recentLogFreqs.length < SMOOTHING_WINDOW) return null;
    return 2 ** median(this.recentLogFreqs);
  }

  update(frame: TrackerFrame): TrackerOutput {
    this.registerLevel(frame.inputLevel);
    const pitch = this.choosePitch(frame);
    return pitch === null
      ? this.handleDropout(frame.inputLevel >= frame.gate)
      : this.handleDetection(pitch);
  }

  reset(): void {
    this.releaseNote();
    this.previousLevel = null;
    this.onsetFramesLeft = 0;
  }

  private registerLevel(level: number): void {
    const previous = this.previousLevel;
    this.previousLevel = level;
    const rising =
      previous !== null &&
      level > 0 &&
      (previous <= 0 || 20 * Math.log10(level / previous) >= ONSET_RISE_DB);

    if (rising) {
      this.onsetFramesLeft = ONSET_FRAMES;
    } else if (this.onsetFramesLeft > 0) {
      this.onsetFramesLeft -= 1;
    }
  }

  private choosePitch(frame: TrackerFrame): number | null {
    const raw = isUsableFrequency(frame.frequency) && frame.confidence > 0 ? frame.frequency : null;
    const tracked = this.onsetFramesLeft > 0 ? null : this.trackedEstimate(frame);

    if (tracked === null) return raw;
    if (raw === null || this.isLowerHarmonicOfTrack(raw)) return tracked;
    return raw;
  }

  private trackedEstimate(frame: TrackerFrame): number | null {
    if (this.trackedFrequency === null) return null;
    if (!isUsableFrequency(frame.trackedFrequency)) return null;
    if ((frame.trackedClarity ?? 0) < TRACK_CONTINUE_CLARITY) return null;
    return frame.trackedFrequency;
  }

  private isLowerHarmonicOfTrack(frequency: number): boolean {
    const track = this.trackedFrequency;
    if (track === null) return false;
    return harmonicRatioOf(1200 * Math.log2(track / frequency)) !== null;
  }

  private handleDetection(frequency: number): TrackerOutput {
    this.missedFrames = 0;
    const smoothed = this.smoothFrequency(frequency);
    this.smoothedFrequency = smoothed;
    return {
      frequency: smoothed,
      state: this.recentLogFreqs.length >= SMOOTHING_WINDOW ? 'locked' : 'listening',
      pitched: true,
    };
  }

  private handleDropout(audible: boolean): TrackerOutput {
    this.missedFrames += 1;
    const budget = audible ? AUDIBLE_HOLD_FRAMES : MAX_DROPOUT_HOLD_FRAMES;

    if (this.smoothedFrequency !== null && this.missedFrames <= budget) {
      return {
        frequency: this.smoothedFrequency,
        state: this.recentLogFreqs.length >= SMOOTHING_WINDOW ? 'holding' : 'listening',
        pitched: false,
      };
    }

    this.releaseNote();
    return IDLE_OUTPUT;
  }

  private releaseNote(): void {
    this.recentLogFreqs = [];
    this.smoothedFrequency = null;
    this.emaLogFreq = null;
    this.missedFrames = 0;
    this.pendingLogFreq = null;
    this.pendingFrames = 0;
  }

  private smoothFrequency(frequency: number): number {
    const candidateLog = Math.log2(frequency);

    if (this.recentLogFreqs.length > 0) {
      const jumpCents = (candidateLog - median(this.recentLogFreqs)) * 1200;

      if (Math.abs(jumpCents) > MAX_SMOOTHING_JUMP_CENTS) {
        const coherent =
          this.pendingLogFreq !== null &&
          Math.abs((candidateLog - this.pendingLogFreq) * 1200) <= MAX_SMOOTHING_JUMP_CENTS;
        this.pendingFrames = coherent ? this.pendingFrames + 1 : 1;
        this.pendingLogFreq = candidateLog;

        const required =
          harmonicRatioOf(Math.abs(jumpCents)) === null ? NOTE_CHANGE_FRAMES : HARMONIC_JUMP_FRAMES;
        if (this.pendingFrames < required) {
          return this.emaLogFreq !== null ? 2 ** this.emaLogFreq : 2 ** median(this.recentLogFreqs);
        }

        this.pendingLogFreq = null;
        this.pendingFrames = 0;
        this.recentLogFreqs = [candidateLog, candidateLog, candidateLog];
        this.emaLogFreq = candidateLog;
        return frequency;
      }
      this.pendingLogFreq = null;
      this.pendingFrames = 0;
    }

    this.recentLogFreqs.push(candidateLog);
    if (this.recentLogFreqs.length > SMOOTHING_WINDOW) {
      this.recentLogFreqs.shift();
    }

    const currentMedianLog = median(this.recentLogFreqs);

    if (this.emaLogFreq === null || this.recentLogFreqs.length < SMOOTHING_WINDOW) {
      this.emaLogFreq = currentMedianLog;
    } else {
      const innovationCents = Math.abs((currentMedianLog - this.emaLogFreq) * 1200);
      const alpha = Math.min(1, EMA_ALPHA + innovationCents / ADAPTIVE_ALPHA_CENTS);
      this.emaLogFreq = alpha * currentMedianLog + (1 - alpha) * this.emaLogFreq;
    }

    return 2 ** this.emaLogFreq;
  }
}

export function harmonicRatioOf(cents: number): number | null {
  for (const ratio of HARMONIC_RATIOS) {
    if (Math.abs(cents - 1200 * Math.log2(ratio)) <= HARMONIC_TOLERANCE_CENTS) return ratio;
  }
  return null;
}

function isUsableFrequency(frequency: number | null | undefined): frequency is number {
  return typeof frequency === 'number' && Number.isFinite(frequency) && frequency > 0;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
