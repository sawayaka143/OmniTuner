import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { CustomTuning, CustomTuningValue } from '../components/custom-tuning/custom-tuning';
import { InstrumentSelector } from '../components/instrument-selector/instrument-selector';
import { PitchDisplay } from '../components/pitch-display/pitch-display';
import { PitchMeter, Tick } from '../components/pitch-meter/pitch-meter';
import { StringList } from '../components/string-list/string-list';
import { INSTRUMENTS } from '../data/instrument.constants';
import { Instrument, Tuning } from '../models/instrument.model';
import { SavedCustomTuning } from '../models/tuner-preferences.model';
import { AudioCaptureService } from '../services/audio-capture-service';
import { TunerPreferences } from '../services/tuner-preferences';
import {
  centsOffsetDisplay,
  findClosestString,
  frequencyToMidiNote,
  hzDisplay,
  isInTune,
  midiNoteLabel,
  midiNoteToFrequency,
  needlePosition,
  NoteInfo,
  noteFromFrequency,
} from '../utils/pitch-utils';

@Component({
  selector: 'app-audio-monitor',
  imports: [CustomTuning, InstrumentSelector, PitchMeter, PitchDisplay, StringList],
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
})
export class AudioMonitor implements OnInit {
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly destroyRef = inject(DestroyRef);

  readonly isCapturing = this.audioCapture.isCapturing;
  readonly frequency = this.audioCapture.frequency;
  readonly trackingState = this.audioCapture.trackingState;
  readonly captureError = this.audioCapture.captureError;

  readonly selectedInstrumentId = signal('guitar');
  readonly selectedTuningId = signal('standard');
  readonly dropdownOpen = signal(false);
  readonly isDeforming = signal(false);
  readonly tuningEditorOpen = signal(false);
  readonly editingTuningId = signal<string | null>(null);
  readonly editorInitialName = signal('');
  readonly editorInitialNotes = signal<readonly number[]>([]);

  private deformTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly instruments = INSTRUMENTS;
  readonly ticks: Tick[] = [];

  readonly selectedInstrumentIndex = computed(() =>
    INSTRUMENTS.findIndex((instrument) => instrument.id === this.selectedInstrumentId()),
  );

  private readonly currentInstrument = computed<Instrument>(
    () =>
      INSTRUMENTS.find((instrument) => instrument.id === this.selectedInstrumentId()) ??
      INSTRUMENTS[0],
  );

  readonly currentInstrumentLabel = computed(() => this.currentInstrument().label);

  readonly availableTunings = computed<readonly Tuning[]>(() => [
    ...this.currentInstrument().tunings,
    ...this.tunerPreferences
      .tuningsForInstrument(this.selectedInstrumentId())
      .map((tuning) => this.toRuntimeTuning(tuning)),
  ]);

  readonly currentTuning = computed<Tuning>(() => {
    const tunings = this.availableTunings();
    return tunings.find((tuning) => tuning.id === this.selectedTuningId()) ?? tunings[0];
  });

  readonly currentStrings = computed(() => this.currentTuning().strings);

  readonly noteInfo = signal<NoteInfo | null>(null);

  readonly currentHz = computed(() => hzDisplay(this.frequency()));

  readonly isLocked = computed(() => this.trackingState() === 'locked');

  readonly statusMessage = computed(() => {
    const error = this.captureError();
    if (error) return error;
    if (!this.isCapturing()) return 'READY TO TUNE';
    return this.isLocked() ? 'LOCKED ON NOTE' : 'LISTENING FOR A NOTE';
  });

  readonly isTuned = computed(() => isInTune(this.noteInfo()));

  readonly needleLeft = computed(() => needlePosition(this.noteInfo()));

  readonly centsOffset = computed(() => centsOffsetDisplay(this.noteInfo()));

  readonly activeString = computed(() =>
    findClosestString(this.frequency(), this.currentStrings()),
  );

  constructor() {
    effect(() => {
      const frequency = this.frequency();
      if (frequency === null || this.trackingState() !== 'locked') {
        this.noteInfo.set(null);
        return;
      }

      const previousSemitone = untracked(() => this.noteInfo())?.semitone;
      this.noteInfo.set(noteFromFrequency(frequency, previousSemitone));
    });
  }

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
    const instrument = INSTRUMENTS.find((candidate) => candidate.id === instrumentId);
    if (!instrument || this.selectedInstrumentId() === instrumentId) return;

    this.selectedInstrumentId.set(instrumentId);
    this.selectedTuningId.set(instrument.tunings[0].id);
    this.dropdownOpen.set(false);
    if (this.deformTimeout !== null) clearTimeout(this.deformTimeout);
    this.isDeforming.set(true);
    this.deformTimeout = setTimeout(() => {
      this.isDeforming.set(false);
      this.deformTimeout = null;
    }, 220);
  }

  protected selectTuning(tuningId: string): void {
    if (!this.availableTunings().some((tuning) => tuning.id === tuningId)) return;
    this.selectedTuningId.set(tuningId);
    this.dropdownOpen.set(false);
  }

  protected openCreateTuning(): void {
    this.editingTuningId.set(null);
    this.editorInitialName.set('');
    this.editorInitialNotes.set(this.notesForTuning(this.currentTuning()));
    this.dropdownOpen.set(false);
    this.tuningEditorOpen.set(true);
  }

  protected openEditTuning(tuningId: string): void {
    const tuning = this.tunerPreferences
      .customTunings()
      .find(
        (candidate) =>
          candidate.id === tuningId && candidate.instrumentId === this.selectedInstrumentId(),
      );
    if (!tuning) return;

    this.editingTuningId.set(tuning.id);
    this.editorInitialName.set(tuning.name);
    this.editorInitialNotes.set([...tuning.notes]);
    this.dropdownOpen.set(false);
    this.tuningEditorOpen.set(true);
  }

  protected deleteCustomTuning(tuningId: string): void {
    const tuning = this.tunerPreferences
      .customTunings()
      .find(
        (candidate) =>
          candidate.id === tuningId && candidate.instrumentId === this.selectedInstrumentId(),
      );
    if (!tuning) return;

    this.tunerPreferences.deleteTuning(tuningId);
    if (this.selectedTuningId() === tuningId) {
      this.selectedTuningId.set(this.currentInstrument().tunings[0].id);
    }
  }

  protected saveCustomTuning(value: CustomTuningValue): void {
    const editingId = this.editingTuningId();
    const tuning = editingId
      ? this.tunerPreferences.updateTuning(editingId, value.name, value.notes)
      : this.tunerPreferences.createTuning(this.selectedInstrumentId(), value.name, value.notes);

    this.selectedTuningId.set(tuning.id);
    this.dismissTuningEditor();
  }

  protected dismissTuningEditor(): void {
    this.tuningEditorOpen.set(false);
    this.editingTuningId.set(null);
  }

  protected toggleDropdown(): void {
    this.dropdownOpen.update((open) => !open);
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

  private toRuntimeTuning(tuning: SavedCustomTuning): Tuning {
    return {
      id: tuning.id,
      label: tuning.name,
      kind: 'custom',
      strings: tuning.notes.map((note) => ({
        name: midiNoteLabel(note),
        freq: midiNoteToFrequency(note),
      })),
    };
  }

  private notesForTuning(tuning: Tuning): readonly number[] {
    return tuning.strings.map((string) => frequencyToMidiNote(string.freq) ?? 69);
  }
}
