import {
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { AccidentalPreference } from '../../models/scale-preferences.model';
import {
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
} from '../../models/tuner-preferences.model';
import { PresetOption, StringEditor, StringEditorValue } from '../string-editor/string-editor';
import { IconButton } from '../../ui/icon-button/icon-button';
import { createDialogExit } from '../../ui/dialog-exit';

export type TuningEditorValue = StringEditorValue;
export type TuningPresetOption = PresetOption;

@Component({
  selector: 'app-tuning-editor',
  templateUrl: './tunings-editor.html',
  styleUrl: './tunings-editor.scss',
  imports: [StringEditor, IconButton],
})
export class TuningEditor {
  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly instrumentLabel = input('');
  readonly initialName = input('');
  readonly initialNotes = input<readonly number[]>([]);
  readonly accidental = input<AccidentalPreference>('sharp');
  readonly presets = input<readonly PresetOption[]>([]);
  readonly referenceNotes = input<readonly number[] | null>(null);
  readonly minMidiNote = input(MIN_TUNER_MIDI_NOTE);
  readonly maxMidiNote = input(MAX_TUNER_MIDI_NOTE);
  readonly maxNameLength = input(MAX_CUSTOM_TUNING_NAME_LENGTH);

  readonly dismiss = output<void>();
  readonly preview = output<readonly number[]>();
  readonly save = output<StringEditorValue>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly exit = createDialogExit(this.document.defaultView, () => this.dismiss.emit());

  constructor() {
    this.destroyRef.onDestroy(() => this.exit.destroy());

    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    const dialog = this.dialog()?.nativeElement;
    if (!dialog?.open || this.exit.closing()) return;
    this.exit.begin();
  }

  protected onDialogAnimationend(event: AnimationEvent): void {
    if (this.exit.ownsAnimation(event)) this.exit.finish();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }
}
