import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { AudioCaptureService } from '../services/audio-capture-service';
import { NOTE_NAMES, INSTRUMENTS } from '../data/instrument.constants';

interface Tick {
  angle: number;
  isMajor: boolean;
  isCenter: boolean;
}

@Component({
  selector: 'app-audio-monitor',
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
})
export class AudioMonitor implements OnInit, OnDestroy {
  protected readonly selectedInstrumentIndex = computed(() => {
    return INSTRUMENTS.findIndex(i => i.id === this.selectedInstrumentId());
  });
  private readonly audioCapture = inject(AudioCaptureService);

  protected readonly audioData = this.audioCapture.audioData;
  protected readonly isCapturing = this.audioCapture.isCapturing;
  protected readonly frequency = this.audioCapture.frequency;

  /** Currently selected instrument index */
  protected readonly selectedInstrumentId = signal<string>('guitar');

  /** Currently selected tuning id */
  protected readonly selectedTuningId = signal<string>('standard');

  /** Whether the tuning dropdown is open */
  protected readonly dropdownOpen = signal(false);

  protected readonly currentInstrument = computed(() =>
    INSTRUMENTS.find(i => i.id === this.selectedInstrumentId()) ?? INSTRUMENTS[0]
  );

  protected readonly availableTunings = computed(() =>
    this.currentInstrument().tunings
  );

  protected readonly currentTuning = computed(() => {
    const tunings = this.availableTunings();
    return tunings.find(t => t.id === this.selectedTuningId()) ?? tunings[0];
  });

  protected readonly currentStrings = computed(() =>
    this.currentTuning().strings
  );

  protected readonly instruments = INSTRUMENTS;

  protected readonly noteInfo = computed(() => {
    const f = this.frequency();
    if (f === null || f <= 0) return null;

    const semitones = 12 * Math.log2(f / 440);
    const rounded = Math.round(semitones);
    const cents = Math.round((semitones - rounded) * 100);
    const idx = ((rounded % 12) + 12) % 12;
    const octave = 4 + Math.floor((rounded + 9) / 12);
    const noteName = NOTE_NAMES[idx];

    return {
      name: `${noteName}${octave}`,
      noteName,
      octave: octave.toString(),
      cents
    };
  });

  protected readonly currentHz = computed(() => {
    const f = this.frequency();
    return f ? `${f.toFixed(2)} Hz` : '— Hz';
  });

  protected readonly isTuned = computed(() => {
    const info = this.noteInfo();
    return info ? Math.abs(info.cents) < 5 : false;
  });

  protected readonly needleAngle = computed(() => {
    const info = this.noteInfo();
    if (!info) return 0;
    return Math.max(-60, Math.min(60, (info.cents / 50) * 60));
  });

  protected readonly centsOffset = computed(() => {
    const info = this.noteInfo();
    if (!info) return '—';
    if (Math.abs(info.cents) < 5) return 'IN TUNE';
    return info.cents < 0
      ? `${Math.abs(info.cents)}¢ FLAT`
      : `${info.cents}¢ SHARP`;
  });

  protected readonly activeString = computed(() => {
    const info = this.noteInfo();
    if (!info) return null;
    const found = this.currentStrings().find(s => s.name === info.name);
    return found ? found.name : null;
  });

  public ticks: Tick[] = [];

  ngOnInit(): void {
    this.generateTicks();
  }

  ngOnDestroy(): void {
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    }
  }

  private generateTicks(): void {
    const numTicks = 41;
    const maxAngle = 60;

    for (let i = 0; i < numTicks; i++) {
      const angle = -maxAngle + (i * (maxAngle * 2) / (numTicks - 1));
      const isCenter = i === Math.floor(numTicks / 2);
      const isMajor = i % 5 === 0 && !isCenter;

      if (isCenter) continue;

      this.ticks.push({ angle, isMajor, isCenter });
    }
  }

  protected selectInstrument(instrumentId: string): void {
    if (this.selectedInstrumentId() === instrumentId) return;
    this.selectedInstrumentId.set(instrumentId);
    // Reset to the first tuning of the new instrument
    const instrument = INSTRUMENTS.find(i => i.id === instrumentId);
    if (instrument) {
      this.selectedTuningId.set(instrument.tunings[0].id);
    }
    this.dropdownOpen.set(false);
  }

  protected selectTuning(tuningId: string): void {
    this.selectedTuningId.set(tuningId);
    this.dropdownOpen.set(false);
  }

  protected toggleDropdown(): void {
    this.dropdownOpen.update(v => !v);
  }

  protected toggleCapture(): void {
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    } else {
      this.audioCapture.startCapture();
    }
  }
}