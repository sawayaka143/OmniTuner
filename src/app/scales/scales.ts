import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { RootNotePicker } from '../components/root-note-picker/root-note-picker';
import { ScalePicker } from '../components/scale-picker/scale-picker';
import { CustomTuning } from '../components/custom-tuning/custom-tuning';
import { Fretboard } from '../components/fretboard/fretboard';
import { IntervalLegend } from '../components/interval-legend/interval-legend';
import { IntervalEntry } from '../models/scale.model';
import {
  ROOT_NOTES,
  SCALES,
  STANDARD_TUNING_NOTES_HIGH_FIRST,
  STANDARD_TUNING_PCS,
} from '../data/scale.constants';
import {
  computeFretboard,
  parseNote,
  preferFlatsFor,
  tuningToPitchClasses,
} from '../utils/scale-theory';

type TuningMode = 'standard' | 'custom';
const FRET_COUNT = 15;

@Component({
  selector: 'app-scales',
  imports: [RootNotePicker, ScalePicker, CustomTuning, Fretboard, IntervalLegend],
  templateUrl: './scales.html',
  styleUrl: './scales.scss',
})
export class Scales {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rootNotes = ROOT_NOTES;
  protected readonly scales = SCALES;
  protected readonly fretCount = FRET_COUNT;

  readonly rootNote = signal('C');
  readonly scaleId = signal('major');
  readonly tuningMode = signal<TuningMode>('standard');
  readonly customNotes = signal<string[]>([...STANDARD_TUNING_NOTES_HIGH_FIRST]);
  readonly rootPickerOpen = signal(false);
  readonly scalePickerOpen = signal(false);

  protected readonly currentScale = computed(
    () => SCALES.find((scale) => scale.id === this.scaleId()) ?? SCALES[0],
  );
  protected readonly intervals = computed<IntervalEntry[]>(() => [
    ...this.currentScale().intervals,
  ]);
  protected readonly preferFlats = computed(() => preferFlatsFor(this.rootNote()));

  /** Translate root-relative scale degrees for the generic, absolute-pitch engine. */
  private readonly fretboardIntervals = computed<IntervalEntry[]>(() => {
    const rootPitchClass = parseNote(this.rootNote()) ?? 0;
    return this.intervals().map((interval) => ({
      ...interval,
      semitones: interval.semitones + rootPitchClass,
    }));
  });

  protected readonly customErrors = computed<boolean[]>(() =>
    tuningToPitchClasses(this.customNotes()).map((pitchClass) => pitchClass === null),
  );
  protected readonly hasCustomError = computed(() => this.customErrors().some(Boolean));

  /** Retain the six-string orientation while a custom field is invalid. */
  private readonly openPitchClasses = computed<number[]>(() => {
    if (this.tuningMode() === 'standard') return [...STANDARD_TUNING_PCS];

    const pitchClasses = tuningToPitchClasses(this.customNotes());
    if (pitchClasses.some((pitchClass) => pitchClass === null)) {
      return [...STANDARD_TUNING_PCS];
    }
    return pitchClasses as number[];
  });

  protected readonly cells = computed(() =>
    computeFretboard(
      this.openPitchClasses(),
      FRET_COUNT,
      this.fretboardIntervals(),
      this.preferFlats(),
    ),
  );

  protected readonly legendIntervals = computed<IntervalEntry[]>(() => {
    const seen = new Set<string>();
    return this.intervals().filter((interval) => {
      if (seen.has(interval.label)) return false;
      seen.add(interval.label);
      return true;
    });
  });

  protected selectRoot(note: string): void {
    this.rootNote.set(note);
    this.rootPickerOpen.set(false);
  }

  protected selectScale(id: string): void {
    this.scaleId.set(id);
    this.scalePickerOpen.set(false);
  }

  protected toggleRootPicker(): void {
    this.scalePickerOpen.set(false);
    this.rootPickerOpen.update((isOpen) => !isOpen);
  }

  protected toggleScalePicker(): void {
    this.rootPickerOpen.set(false);
    this.scalePickerOpen.update((isOpen) => !isOpen);
  }

  protected closePickers(): void {
    this.rootPickerOpen.set(false);
    this.scalePickerOpen.set(false);
  }

  protected setTuningMode(mode: TuningMode): void {
    this.tuningMode.set(mode);
  }

  protected onCustomChange(index: number, value: string): void {
    this.customNotes.update((notes) => {
      const next = [...notes];
      next[index] = value;
      return next;
    });
  }
}