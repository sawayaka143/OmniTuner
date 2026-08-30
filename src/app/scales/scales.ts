import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RootNotePicker } from '../components/root-note-picker/root-note-picker';
import { ScalePicker } from '../components/scale-picker/scale-picker';
import { Fretboard } from '../components/fretboard/fretboard';
import { FretCell, IntervalEntry, ScaleTone } from '../models/scale.model';
import { AccidentalPreference, LabelMode, ScaleFretCount } from '../models/scale-preferences.model';
import { FLAT_NAMES, SCALES, SHARP_NAMES } from '../data/scale.constants';
import { MAX_TUNING_MIDI_NOTE, MIN_TUNING_MIDI_NOTE } from '../data/scale-tuning.constants';
import { textColorOn } from '../data/interval-colors';
import { computeFretboard, noteName, parseNote } from '../utils/scale-theory';
import { frequencyToMidiNote } from '../utils/pitch-utils';
import { InstrumentRegistry } from '../services/instrument-registry';
import { Instrument } from '../models/instrument.model';
import { Listbox } from '../ui/listbox/listbox';
import { ScalePreferences } from '../services/scale-preferences';
import { ScalePlayback } from '../services/scale-playback';
import { TuningSelector, TuningOption } from './tuning-selector/tuning-selector';
import {
  TuningEditor,
  TuningEditorValue,
  TuningPresetOption,
} from '../components/tunings-editor/tunings-editor';
import { ScaleOptions } from './scale-options/scale-options';
import { ScaleNotes } from './scale-notes/scale-notes';

interface PreviewTuning {
  readonly name: string;
  readonly notes: readonly number[];
}

@Component({
  selector: 'app-scales',
  imports: [
    RootNotePicker,
    ScalePicker,
    TuningSelector,
    TuningEditor,
    ScaleOptions,
    ScaleNotes,
    Fretboard,
    Listbox,
  ],
  templateUrl: './scales.html',
  styleUrl: './scales.scss',
})
export class Scales {
  private readonly preferences = inject(ScalePreferences);
  private readonly registry = inject(InstrumentRegistry);
  private readonly playback = inject(ScalePlayback);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly scales = SCALES;
  protected readonly preferencesState = this.preferences.state;

  readonly rootPickerOpen = signal(false);
  readonly scalePickerOpen = signal(false);
  readonly instrumentPickerOpen = signal(false);
  readonly tuningPickerOpen = signal(false);
  readonly tuningEditorOpen = signal(false);
  protected readonly editingTuningId = signal<string | null>(null);

  protected readonly activeMidi = signal<number | null>(null);
  protected readonly activeCell = signal<FretCell | null>(null);
  protected readonly activePitchClass = computed(() => {
    const midi = this.activeMidi();
    return midi === null ? null : midi % 12;
  });
  protected readonly inspectedCell = signal<FretCell | null>(null);
  protected readonly playbackSource = signal<'scale' | 'tuning' | null>(null);

  private readonly previewTuning = signal<PreviewTuning | null>(null);
  protected readonly editorInitialName = signal('');
  protected readonly editorInitialNotes = signal<readonly number[]>([]);
  protected readonly minTuningMidiNote = MIN_TUNING_MIDI_NOTE;
  protected readonly maxTuningMidiNote = MAX_TUNING_MIDI_NOTE;
  protected readonly maxTuningNameLength = 40;
  protected readonly editorMode = computed<'create' | 'edit'>(() =>
    this.editingTuningId() === null ? 'create' : 'edit',
  );
  private muteGain: GainNode | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sequenceTimers = new Set<ReturnType<typeof setTimeout>>();

  protected readonly tuningPresets = computed<readonly TuningOption[]>(() =>
    this.registry.selectedInstrument().tunings.map((tuning) => ({
      id: tuning.id,
      name: tuning.label,
      notes: tuning.strings.map((s) => frequencyToMidiNote(s.freq) ?? 69),
      kind: 'preset' as const,
    })),
  );

  protected readonly savedTunings = computed<readonly TuningOption[]>(() =>
    this.registry.tuningsForInstrument(this.registry.selectedInstrumentId()).map((t) => ({
      id: t.id,
      name: t.name,
      notes: t.notes,
      kind: 'custom' as const,
    })),
  );

  protected readonly selectedTuningId = this.registry.selectedTuningId;
  protected readonly selectedTuningName = computed(() => this.registry.selectedTuning().label);

  protected readonly editorPresets = computed<readonly TuningPresetOption[]>(() =>
    this.tuningPresets().map((p) => ({ id: p.id, name: p.name, notes: p.notes })),
  );

  protected readonly referenceNotes = computed<readonly number[] | null>(
    () => this.tuningPresets()[0]?.notes ?? null,
  );

  protected readonly instrumentLabel = computed(() => this.registry.selectedInstrument().label);

  protected readonly instruments = this.registry.instruments;
  protected readonly selectedInstrument = this.registry.selectedInstrument;
  protected readonly instrumentLabelFn = (o: Instrument): string => o.label;
  protected readonly instrumentTrackFn = (o: Instrument): string => o.id;

  protected readonly rootNotes = computed(() =>
    this.preferencesState().accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES,
  );
  protected readonly rootNote = computed(() =>
    noteName(this.preferencesState().rootPitchClass, this.preferencesState().accidental === 'flat'),
  );
  protected readonly scaleId = computed(() => this.preferencesState().scaleId);
  protected readonly currentScale = computed(
    () => SCALES.find((scale) => scale.id === this.scaleId()) ?? SCALES[0],
  );
  protected readonly intervals = computed<IntervalEntry[]>(() => [
    ...this.currentScale().intervals,
  ]);
  protected readonly preferFlats = computed(() => this.preferencesState().accidental === 'flat');
  protected readonly fretCount = computed(() => this.preferencesState().fretCount);
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));

  protected readonly activeTuning = computed<PreviewTuning>(() => {
    const preview = this.previewTuning();
    if (preview) return preview;
    const selected = this.registry.selectedTuning();
    return {
      name: selected.label,
      notes: selected.strings.map((s) => frequencyToMidiNote(s.freq) ?? 69),
    };
  });

  private readonly fretboardIntervals = computed<IntervalEntry[]>(() => {
    const rootPitchClass = this.preferencesState().rootPitchClass;
    return this.intervals().map((interval) => ({
      ...interval,
      semitones: interval.semitones + rootPitchClass,
    }));
  });

  private readonly openMidiNotes = computed<number[]>(() =>
    [...this.activeTuning().notes].reverse(),
  );
  private readonly openPitchClasses = computed<number[]>(() =>
    this.openMidiNotes().map((midi) => midi % 12),
  );

  protected readonly cells = computed(() =>
    computeFretboard(
      this.openPitchClasses(),
      this.fretCount(),
      this.fretboardIntervals(),
      this.preferFlats(),
      this.openMidiNotes(),
    ).map((row) =>
      row.map((cell) =>
        cell.interval
          ? {
              ...cell,
              color: cell.isRoot
                ? this.preferencesState().rootNoteColor
                : this.preferencesState().noteColor,
            }
          : cell,
      ),
    ),
  );

  private readonly scaleRootMidi = computed(
    () => 40 + ((this.preferencesState().rootPitchClass - 4 + 12) % 12),
  );

  protected readonly scaleTones = computed<readonly ScaleTone[]>(() =>
    this.intervals().map((interval) => {
      const midi = this.scaleRootMidi() + interval.semitones;
      const pitchClass = midi % 12;
      return {
        pitchClass,
        midi,
        noteName: noteName(pitchClass, this.preferFlats()),
        interval,
        color:
          interval.semitones % 12 === 0
            ? this.preferencesState().rootNoteColor
            : this.preferencesState().noteColor,
        isRoot: interval.semitones % 12 === 0,
      };
    }),
  );

  protected readonly tuningNotesLabel = computed(() =>
    this.activeTuning()
      .notes.map((midi) => this.midiNoteName(midi))
      .join('  '),
  );

  protected readonly readout = computed(() => {
    const cell = this.inspectedCell();
    if (!cell) {
      return `${this.rootNote()} ${this.currentScale().label} · ${this.intervals().length} notes`;
    }
    const position = cell.fret === 0 ? 'open string' : `fret ${cell.fret}`;
    const note = cell.midi === null ? cell.noteName : this.midiNoteName(cell.midi);
    return `${note} · string ${cell.stringIndex + 1} · ${position}`;
  });

  protected readonly playbackError = computed(() => this.playback.error());

  protected dismissPlaybackError(): void {
    this.playback.clearError();
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPlayback());
    effect(() => {
      this.activeTuning();
      this.fretCount();
      untracked(() => {
        if (this.playbackSource() !== null) this.stopPlayback();
      });
    });
  }

  protected selectRoot(note: string): void {
    const pitchClass = parseNote(note);
    if (pitchClass !== null) this.preferences.setRootPitchClass(pitchClass);
    this.rootPickerOpen.set(false);
  }

  protected selectScale(id: string): void {
    this.preferences.setScaleId(id);
    this.scalePickerOpen.set(false);
  }

  protected setAccidental(accidental: AccidentalPreference): void {
    this.preferences.setAccidental(accidental);
  }

  protected setFretCount(fretCount: ScaleFretCount): void {
    this.preferences.setFretCount(fretCount);
  }

  protected setLabelMode(labelMode: LabelMode): void {
    this.preferences.setLabelMode(labelMode);
  }

  protected setShowOutsideScale(showOutsideScale: boolean): void {
    this.preferences.setShowOutsideScale(showOutsideScale);
  }

  protected selectTuning(tuningId: string): void {
    this.previewTuning.set(null);
    this.registry.selectTuning(tuningId);
    this.tuningPickerOpen.set(false);
  }

  protected deleteTuning(id: string): void {
    this.previewTuning.set(null);
    this.registry.deleteTuning(id);
    this.closePickers();
  }

  protected playCell(cell: FretCell): void {
    if (cell.midi === null) return;
    this.playback.playSampleNote(cell.midi);
    if (this.playback.error()) return;
    this.pulse(cell.midi, cell);
  }

  protected playTone(tone: ScaleTone): void {
    this.playback.playSampleNote(tone.midi);
    if (this.playback.error()) return;
    this.pulse(tone.midi, this.findCellForMidi(tone.midi));
  }

  protected playScale(): void {
    if (this.playbackSource() === 'scale') {
      this.stopPlayback();
      return;
    }

    const tones = this.scaleTones();
    const entries: { midi: number; highlight: FretCell | null }[] = [
      ...tones.map((tone) => ({
        midi: tone.midi,
        highlight: this.findCellForMidi(tone.midi),
      })),
      {
        midi: tones[0].midi + 12,
        highlight: this.findCellForMidi(tones[0].midi + 12),
      },
    ];

    this.playNotes(entries, 'scale');
  }

  protected playTuning(): void {
    if (this.playbackSource() === 'tuning') {
      this.stopPlayback();
      return;
    }

    const notes = this.activeTuning().notes;
    const rows = this.cells();
    const entries = notes.map((midi, index) => ({
      midi,
      highlight: rows[rows.length - 1 - index]?.find((cell) => cell.fret === 0) ?? null,
    }));

    this.playNotes(entries, 'tuning');
  }

  private playNotes(
    entries: { midi: number; highlight: FretCell | null }[],
    source: 'scale' | 'tuning',
  ): void {
    this.stopPlayback();

    const muteGain = this.playback.createGain();
    if (!muteGain) return;
    muteGain.gain.value = 1;
    this.muteGain = muteGain;

    this.playbackSource.set(source);
    this.playback.isPlaying.set(true);

    entries.forEach((entry, index) => {
      const delaySeconds = index * 0.16;
      this.playback.playSampleNote(entry.midi, delaySeconds, 0.6, muteGain);
      this.queueTimer(
        () => this.pulse(entry.midi, entry.highlight, source === 'scale'),
        index * 160,
      );
    });

    this.queueTimer(
      () => {
        this.playbackSource.set(null);
        this.playback.isPlaying.set(false);
        this.activeMidi.set(null);
        this.activeCell.set(null);
        this.cleanupMuteGain();
      },
      entries.length * 160 + 380,
    );
  }

  private stopPlayback(): void {
    this.clearPlaybackTimers();
  }

  private cleanupMuteGain(): void {
    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {}
      this.muteGain = null;
    }
  }

  protected inspectCell(cell: FretCell | null): void {
    this.inspectedCell.set(cell);
  }

  protected toggleRootPicker(): void {
    this.scalePickerOpen.set(false);
    this.instrumentPickerOpen.set(false);
    this.tuningPickerOpen.set(false);
    this.rootPickerOpen.update((isOpen) => !isOpen);
  }

  protected toggleScalePicker(): void {
    this.rootPickerOpen.set(false);
    this.instrumentPickerOpen.set(false);
    this.tuningPickerOpen.set(false);
    this.scalePickerOpen.update((isOpen) => !isOpen);
  }

  protected toggleInstrumentPicker(): void {
    this.rootPickerOpen.set(false);
    this.scalePickerOpen.set(false);
    this.tuningPickerOpen.set(false);
    this.instrumentPickerOpen.update((isOpen) => !isOpen);
  }

  protected toggleTuningPicker(): void {
    this.rootPickerOpen.set(false);
    this.scalePickerOpen.set(false);
    this.instrumentPickerOpen.set(false);
    this.tuningPickerOpen.update((isOpen) => !isOpen);
  }

  protected closePickers(): void {
    this.rootPickerOpen.set(false);
    this.scalePickerOpen.set(false);
    this.instrumentPickerOpen.set(false);
    this.tuningPickerOpen.set(false);
  }

  protected selectInstrument(instrument: Instrument): void {
    this.registry.selectInstrument(instrument.id);
    this.instrumentPickerOpen.set(false);
  }

  protected openTuningEditor(id: string | null = null): void {
    this.closePickers();
    this.previewTuning.set(null);

    if (id === null) {
      this.editingTuningId.set(null);
      this.editorInitialName.set('');
      this.editorInitialNotes.set([...this.activeTuning().notes]);
      this.tuningEditorOpen.set(true);
      return;
    }

    const tuning = this.registry
      .tuningsForInstrument(this.registry.selectedInstrumentId())
      .find((t) => t.id === id);
    if (!tuning) {
      this.editingTuningId.set(null);
      this.tuningEditorOpen.set(false);
      return;
    }

    this.editingTuningId.set(id);
    this.editorInitialName.set(tuning.name);
    this.editorInitialNotes.set([...tuning.notes]);
    this.tuningEditorOpen.set(true);
  }

  protected previewCustomTuning(notes: readonly number[]): void {
    const name = this.editingTuningId() === null ? 'Custom' : this.editorInitialName();
    this.previewTuning.set({ name, notes });
  }

  protected saveCustomTuning(event: TuningEditorValue): void {
    const editingId = this.editingTuningId();
    const instrumentId = this.registry.selectedInstrumentId();
    if (editingId === null) {
      const tuning = this.registry.createTuning(instrumentId, event.name, event.notes);
      this.registry.selectTuning(tuning.id);
    } else {
      this.registry.updateTuning(editingId, event.name, event.notes);
    }
    this.closeTuningEditor();
  }

  protected dismissTuningEditor(): void {
    this.closeTuningEditor();
  }

  private closeTuningEditor(): void {
    this.previewTuning.set(null);
    this.editingTuningId.set(null);
    this.tuningEditorOpen.set(false);
  }

  private pulse(midi: number, cell: FretCell | null, lightScaleNote = true): void {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    if (lightScaleNote) this.activeMidi.set(midi);
    this.activeCell.set(cell);
    this.pulseTimer = setTimeout(() => {
      if (lightScaleNote) this.activeMidi.set(null);
      this.activeCell.set(null);
      this.pulseTimer = null;
    }, 240);
  }

  private findCellForMidi(midi: number): FretCell | null {
    for (const row of this.cells()) {
      const cell = row.find((candidate) => candidate.midi === midi && candidate.interval !== null);
      if (cell) return cell;
    }
    return null;
  }

  private queueTimer(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.sequenceTimers.delete(timer);
      callback();
    }, delay);
    this.sequenceTimers.add(timer);
  }

  private clearPlaybackTimers(): void {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseTimer = null;
    for (const timer of this.sequenceTimers) clearTimeout(timer);
    this.sequenceTimers.clear();
    this.activeMidi.set(null);
    this.activeCell.set(null);
    this.playbackSource.set(null);
    this.playback.isPlaying.set(false);
    this.cleanupMuteGain();
  }

  private midiNoteName(midi: number): string {
    return `${noteName(midi % 12, this.preferFlats())}${Math.floor(midi / 12) - 1}`;
  }
}
