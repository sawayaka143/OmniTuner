import {
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
} from '../../models/tuner-preferences.model';
import { midiNoteLabel } from '../../utils/pitch-utils';

export interface CustomTuningValue {
  readonly name: string;
  readonly notes: readonly number[];
}

@Component({
  selector: 'app-custom-tuning',
  templateUrl: './custom-tuning.html',
  styleUrl: './custom-tuning.scss',
})
export class CustomTuning {
  readonly open = input(false);
  readonly editing = input(false);
  readonly instrumentLabel = input.required<string>();
  readonly initialName = input('');
  readonly initialNotes = input.required<readonly number[]>();

  readonly dismiss = output<void>();
  readonly save = output<CustomTuningValue>();

  protected readonly maxNameLength = MAX_CUSTOM_TUNING_NAME_LENGTH;
  protected readonly minMidiNote = MIN_TUNER_MIDI_NOTE;
  protected readonly maxMidiNote = MAX_TUNER_MIDI_NOTE;
  protected readonly name = signal('');
  protected readonly notes = signal<readonly number[]>([]);
  protected readonly nameInvalid = computed(() => this.name().trim().length === 0);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        this.name.set(this.initialName());
        this.notes.set([...this.initialNotes()]);
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected noteLabel(midiNote: number): string {
    return midiNoteLabel(midiNote);
  }

  protected onNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.name.set(target.value);
  }

  protected step(index: number, direction: -1 | 1): void {
    const current = this.notes();
    const nextNote = Math.min(
      this.maxMidiNote,
      Math.max(this.minMidiNote, current[index] + direction),
    );
    if (nextNote === current[index]) return;

    const next = [...current];
    next[index] = nextNote;
    this.notes.set(next);
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (!name) return;
    this.save.emit({ name, notes: [...this.notes()] });
  }
}
