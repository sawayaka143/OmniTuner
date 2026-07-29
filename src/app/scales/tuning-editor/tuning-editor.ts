import { Component, computed, effect, ElementRef, input, output, signal, viewChild } from '@angular/core';
import {
  MAX_TUNING_MIDI_NOTE,
  MIN_TUNING_MIDI_NOTE,
  SCALE_TUNING_PRESETS,
} from '../../data/scale-tuning.constants';
import {
  AccidentalPreference,
  SixStringMidiNotes,
  TuningPreset,
} from '../../models/scale-preferences.model';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

@Component({
  selector: 'app-tuning-editor',
  templateUrl: './tuning-editor.html',
  styleUrl: './tuning-editor.scss',
})
export class TuningEditor {
  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly initialName = input('');
  readonly initialNotes = input.required<SixStringMidiNotes>();
  readonly accidental = input<AccidentalPreference>('sharp');

  readonly dismiss = output<void>();
  readonly preview = output<SixStringMidiNotes>();
  readonly save = output<{ name: string; notes: SixStringMidiNotes }>();

  protected readonly presets = SCALE_TUNING_PRESETS.filter((_, index) => [0, 1, 3, 4].includes(index));
  protected readonly stringIndexes = [5, 4, 3, 2, 1, 0] as const;
  protected readonly notes = signal<SixStringMidiNotes>(SCALE_TUNING_PRESETS[0].notes);
  protected readonly name = signal('');
  protected readonly title = computed(() =>
    this.mode() === 'edit' ? 'Edit custom tuning' : 'New custom tuning',
  );
  protected readonly subtitle = computed(() =>
    this.mode() === 'edit'
      ? 'Update the name or string pitches'
      : 'Set each string by semitone',
  );
  protected readonly saveLabel = computed(() =>
    this.mode() === 'edit' ? 'Update tuning' : 'Save tuning',
  );

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private repeatDelay: ReturnType<typeof setTimeout> | null = null;
  private repeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        this.notes.set([...this.initialNotes()] as SixStringMidiNotes);
        this.name.set(this.initialName());
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected noteName(midi: number): string {
    const names = this.accidental() === 'flat' ? FLAT_NAMES : SHARP_NAMES;
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  protected isChangedFromStandard(index: number): boolean {
    return this.notes()[index] !== SCALE_TUNING_PRESETS[0].notes[index];
  }

  protected usePreset(preset: TuningPreset): void {
    this.name.set('');
    this.setNotes(preset.notes);
  }

  protected onNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.name.set(target.value);
  }

  protected onKeyboardStep(event: MouseEvent, index: number, direction: -1 | 1): void {
    if (event.detail === 0) this.step(index, direction);
  }

  protected startRepeating(event: PointerEvent, index: number, direction: -1 | 1): void {
    event.preventDefault();
    this.stopRepeating();
    this.step(index, direction);
    this.repeatDelay = setTimeout(() => {
      this.repeatInterval = setInterval(() => this.step(index, direction), 85);
    }, 420);
  }

  protected stopRepeating(): void {
    if (this.repeatDelay) clearTimeout(this.repeatDelay);
    if (this.repeatInterval) clearInterval(this.repeatInterval);
    this.repeatDelay = null;
    this.repeatInterval = null;
  }

  protected onWheel(event: WheelEvent, index: number): void {
    event.preventDefault();
    this.step(index, event.deltaY > 0 ? -1 : 1);
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.stopRepeating();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  protected submit(): void {
    this.save.emit({ name: this.name(), notes: this.notes() });
  }

  private step(index: number, direction: -1 | 1): void {
    const current = this.notes();
    const nextValue = Math.min(
      MAX_TUNING_MIDI_NOTE,
      Math.max(MIN_TUNING_MIDI_NOTE, current[index] + direction),
    );
    if (nextValue === current[index]) return;

    const next = [...current] as [number, number, number, number, number, number];
    next[index] = nextValue;
    this.setNotes(next);
  }

  private setNotes(notes: SixStringMidiNotes): void {
    const next = [...notes] as SixStringMidiNotes;
    this.notes.set(next);
    this.preview.emit(next);
  }
}
