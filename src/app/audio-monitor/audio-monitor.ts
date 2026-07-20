import { Component, inject, computed, signal, DestroyRef, OnInit } from '@angular/core';
import { AudioCaptureService } from '../services/audio-capture-service';
import { INSTRUMENTS } from '../data/instrument.constants';
import { InstrumentSelector } from '../components/instrument-selector/instrument-selector';
import { PitchMeter, Tick } from '../components/pitch-meter/pitch-meter';
import { PitchDisplay } from '../components/pitch-display/pitch-display';
import { StringList } from '../components/string-list/string-list';
import {
  noteFromFrequency,
  hzDisplay,
  centsOffsetDisplay,
  needlePosition,
  isInTune,
  findClosestString,
} from '../utils/pitch-utils';

@Component({
  selector: 'app-audio-monitor',
  imports: [InstrumentSelector, PitchMeter, PitchDisplay, StringList],
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
})
export class AudioMonitor implements OnInit {
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isCapturing = this.audioCapture.isCapturing;
  readonly frequency = this.audioCapture.frequency;

  readonly selectedInstrumentId = signal('guitar');
  readonly selectedTuningId = signal('standard');
  readonly dropdownOpen = signal(false);
  readonly isDeforming = signal(false);

  private deformTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly instruments = INSTRUMENTS;
  readonly ticks: Tick[] = [];

  readonly selectedInstrumentIndex = computed(() =>
    INSTRUMENTS.findIndex((i) => i.id === this.selectedInstrumentId()),
  );

  private readonly currentInstrument = computed(
    () => INSTRUMENTS.find((i) => i.id === this.selectedInstrumentId()) ?? INSTRUMENTS[0],
  );

  readonly availableTunings = computed(() => this.currentInstrument().tunings);

  readonly currentTuning = computed(() => {
    const tunings = this.availableTunings();
    return tunings.find((t) => t.id === this.selectedTuningId()) ?? tunings[0];
  });

  readonly currentStrings = computed(() => this.currentTuning().strings);

  readonly noteInfo = computed(() => {
    const f = this.frequency();
    return f ? noteFromFrequency(f) : null;
  });

  readonly currentHz = computed(() => hzDisplay(this.frequency()));

  readonly isTuned = computed(() => isInTune(this.noteInfo()));

  readonly needleLeft = computed(() => needlePosition(this.noteInfo()));

  readonly centsOffset = computed(() => centsOffsetDisplay(this.noteInfo()));

  readonly activeString = computed(() =>
    findClosestString(this.frequency(), this.currentStrings()),
  );

  ngOnInit(): void {
    const totalTicks = 41;
    for (let i = 0; i < totalTicks; i++) {
      const leftPos = `${(i / (totalTicks - 1)) * 100}%`;
      let type: 'normal' | 'major' | 'center' = 'normal';
      if (i === 20) type = 'center';
      else if (i % 5 === 0) type = 'major';
      this.ticks.push({ leftPos, type });
    }

    this.destroyRef.onDestroy(() => {
      if (this.isCapturing()) {
        this.audioCapture.stopCapture();
      }
    });
  }

  protected selectInstrument(instrumentId: string): void {
    if (this.selectedInstrumentId() === instrumentId) return;
    this.selectedInstrumentId.set(instrumentId);
    const instrument = INSTRUMENTS.find((i) => i.id === instrumentId);
    if (instrument) {
      this.selectedTuningId.set(instrument.tunings[0].id);
    }
    this.dropdownOpen.set(false);
    if (this.deformTimeout !== null) clearTimeout(this.deformTimeout);
    this.isDeforming.set(true);
    this.deformTimeout = setTimeout(() => {
      this.isDeforming.set(false);
      this.deformTimeout = null;
    }, 220);
  }

  protected selectTuning(tuningId: string): void {
    this.selectedTuningId.set(tuningId);
    this.dropdownOpen.set(false);
  }

  protected toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  protected closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  protected toggleCapture(): void {
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    } else {
      this.audioCapture.startCapture();
    }
  }
}