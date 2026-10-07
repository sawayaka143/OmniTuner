import { Component, computed, inject, signal } from '@angular/core';

import { AudioCaptureService } from '../services/audio-capture-service';
import {
  FrameOutcome,
  encodeSample,
  formatDiagnosticsReport,
  levelToDecibels,
  sampleFileName,
} from '../services/capture-diagnostics';
import { MAX_FREQUENCY, MIN_CONFIDENCE, SILENCE_RMS } from '../services/pitch-detection';
import { PillButton } from '../ui/pill-button/pill-button';

const OUTCOME_LABELS: Record<FrameOutcome, string> = {
  detected: 'Pitch detected',
  unclear: 'Audible, no clear pitch',
  silent: 'Below silence gate',
};

const METER_FLOOR_DB = -80;

export const SAMPLE_FRAME_COUNT = 110;

@Component({
  selector: 'app-tuner-diagnostics',
  imports: [PillButton],
  template: `
    <section class="diagnostics" aria-labelledby="diagnostics-title">
      <header class="diagnostics-header">
        <h3 id="diagnostics-title">Diagnostics</h3>
        <div class="diagnostics-actions">
          <app-pill-button label="Reset" iconOn="refresh" (activate)="reset()" />
          <app-pill-button label="Copy report" iconOn="copy" (activate)="copyReport()" />
          <app-pill-button
            [label]="recordLabel()"
            iconOn="microphone"
            [disabled]="recordingProgress() !== null"
            (activate)="recordSample()"
          />
        </div>
      </header>

      @if (stats(); as stats) {
        <div class="level-meter" aria-hidden="true">
          <span class="level-fill" [style.width.%]="levelPercent()"></span>
          <span class="level-gate" [style.left.%]="gatePercent()"></span>
        </div>

        <dl class="readout">
          <div>
            <dt>Level</dt>
            <dd>
              {{ levelText() }} <small>gate {{ gateText() }}</small>
            </dd>
          </div>
          <div>
            <dt>Noise floor</dt>
            <dd>{{ noiseFloorText() }}</dd>
          </div>
          <div>
            <dt>Last frame</dt>
            <dd [attr.data-outcome]="stats.last?.outcome">{{ outcomeText() }}</dd>
          </div>
          <div>
            <dt>Clarity</dt>
            <dd>
              {{ clarityText() }} <small>needs {{ minClarity }}</small>
            </dd>
          </div>
          <div>
            <dt>Raw pitch</dt>
            <dd>{{ candidateText() }}</dd>
          </div>
          <div>
            <dt>Frames</dt>
            <dd>
              {{ percentText(stats.outcomes.detected) }} detected ·
              {{ percentText(stats.outcomes.unclear) }} unclear ·
              {{ percentText(stats.outcomes.silent) }} silent
            </dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>{{ rangeText() }}</dd>
          </div>
          <div>
            <dt>Analysis</dt>
            <dd>{{ timingText() }}</dd>
          </div>
          <div>
            <dt>Mic</dt>
            <dd>{{ micText() }}</dd>
          </div>
          <div>
            <dt>Processing</dt>
            <dd>{{ processingText() }}</dd>
          </div>
        </dl>
      } @else {
        <p class="diagnostics-empty">Start the tuner to collect diagnostics.</p>
      }

      <p class="status" aria-live="polite">{{ status() }}</p>
    </section>
  `,
  styleUrl: './tuner-diagnostics.scss',
})
export class TunerDiagnostics {
  private readonly audioCapture = inject(AudioCaptureService);

  protected readonly stats = this.audioCapture.diagnostics;
  protected readonly recordingProgress = this.audioCapture.recordingProgress;
  protected readonly status = signal('');

  protected readonly minClarity = MIN_CONFIDENCE.toFixed(2);

  private readonly gateDb = computed(() =>
    levelToDecibels(this.stats()?.last?.gate ?? SILENCE_RMS),
  );

  protected readonly gatePercent = computed(() => decibelsToPercent(this.gateDb()));
  protected readonly gateText = computed(() => `${this.gateDb().toFixed(0)} dB`);

  protected readonly noiseFloorText = computed(() => {
    const floor = this.stats()?.last?.noiseFloor;
    return floor == null ? '—' : `${levelToDecibels(floor).toFixed(1)} dBFS`;
  });

  protected readonly recordLabel = computed(() => {
    const progress = this.recordingProgress();
    return progress === null ? 'Record 5 s' : `Recording ${Math.round(progress * 100)}%`;
  });

  private readonly lastLevel = computed(() => this.stats()?.last?.inputLevel ?? 0);

  protected readonly levelPercent = computed(() =>
    decibelsToPercent(levelToDecibels(this.lastLevel())),
  );

  protected readonly levelText = computed(() => {
    const db = levelToDecibels(this.lastLevel());
    return Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : '—';
  });

  protected readonly outcomeText = computed(() => {
    const outcome = this.stats()?.last?.outcome;
    return outcome ? OUTCOME_LABELS[outcome] : 'Waiting for audio';
  });

  protected readonly clarityText = computed(() => {
    const clarity = this.stats()?.last?.clarity;
    return clarity == null ? '—' : clarity.toFixed(2);
  });

  protected readonly candidateText = computed(() => {
    const candidate = this.stats()?.last?.candidateFrequency;
    return candidate == null ? '—' : `${candidate.toFixed(1)} Hz`;
  });

  protected readonly timingText = computed(() => {
    const stats = this.stats();
    if (!stats || stats.averageAnalysisMs === null) return '—';
    const rate = stats.analysesPerSecond?.toFixed(1) ?? '—';
    return `${stats.averageAnalysisMs.toFixed(1)} ms avg · ${stats.slowestAnalysisMs?.toFixed(1)} ms max · ${rate}/s`;
  });

  protected readonly rangeText = computed(() => {
    const range = this.stats()?.range;
    if (!range) return '—';
    return `${range.minFrequency.toFixed(0)}–${MAX_FREQUENCY} Hz · low cut ${range.highpassHz.toFixed(0)} Hz`;
  });

  protected readonly micText = computed(() => {
    const mic = this.stats()?.mic;
    if (!mic) return '—';
    const channels = mic.channelCount ?? '?';
    const rate = mic.trackSampleRate ?? mic.contextSampleRate;
    return `${mic.label || 'Unnamed'} · ${channels} ch · ${rate} Hz`;
  });

  protected readonly processingText = computed(() => {
    const mic = this.stats()?.mic;
    if (!mic) return '—';
    const flag = (value: boolean | null): string =>
      value === null ? 'unknown' : value ? 'on' : 'off';
    return `echo ${flag(mic.echoCancellation)} · noise ${flag(mic.noiseSuppression)} · gain ${flag(mic.autoGainControl)}`;
  });

  protected percentText(count: number): string {
    const frames = this.stats()?.frames ?? 0;
    return frames > 0 ? `${Math.round((count / frames) * 100)}%` : '0%';
  }

  protected reset(): void {
    this.audioCapture.resetDiagnostics();
    this.status.set('');
  }

  protected async copyReport(): Promise<void> {
    const stats = this.stats();
    if (!stats) {
      this.status.set('Start the tuner first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatDiagnosticsReport(stats));
      this.status.set('Report copied.');
    } catch {
      this.status.set('Copy failed.');
    }
  }

  protected async recordSample(): Promise<void> {
    this.status.set('Recording… play a string now.');
    try {
      const sample = await this.audioCapture.recordSample(SAMPLE_FRAME_COUNT);
      const wav = encodeSample(sample, this.stats()?.mic ?? null);
      downloadFile(new Blob([wav], { type: 'audio/wav' }), sampleFileName(new Date()));
      this.status.set('Sample saved.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Recording failed.');
    }
  }
}

function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decibelsToPercent(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(100, Math.max(0, ((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100));
}
