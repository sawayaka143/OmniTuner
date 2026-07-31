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
import { FLAT_DISPLAY_NAMES, SHARP_DISPLAY_NAMES } from '../../data/note-display-names';

export type AccidentalPreference = 'sharp' | 'flat';

export interface TuningPresetOption {
  readonly id: unknown;
  readonly name: string;
  readonly notes: readonly number[];
}

export interface TuningEditorValue {
  readonly name: string;
  readonly notes: readonly number[];
}

const SHARP_NAMES = SHARP_DISPLAY_NAMES;
const FLAT_NAMES = FLAT_DISPLAY_NAMES;

interface DisplayRow {
  readonly row: number; // 0 = top of the list
  readonly noteIndex: number; // index into notes()
  readonly stringNumber: number; // 1 = highest pitch (top)
  readonly weight: number; // line thickness in px
}

@Component({
  selector: 'app-tuning-editor',
  templateUrl: './tunings-editor.html',
  styleUrl: './tunings-editor.scss',
})
export class TuningEditor {
  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly instrumentLabel = input('');
  readonly initialName = input('');
  readonly initialNotes = input<readonly number[]>([]);
  readonly accidental = input<AccidentalPreference>('sharp');
  readonly presets = input<readonly TuningPresetOption[]>([]);
  readonly referenceNotes = input<readonly number[] | null>(null);
  readonly minMidiNote = input(24);
  readonly maxMidiNote = input(96);
  readonly maxNameLength = input(40);

  readonly dismiss = output<void>();
  readonly preview = output<readonly number[]>();
  readonly save = output<TuningEditorValue>();

  protected readonly name = signal('');
  protected readonly notes = signal<number[]>([]);

  protected readonly title = computed(() =>
    this.mode() === 'edit' ? 'Edit custom tuning' : 'New custom tuning',
  );
  protected readonly subtitle = computed(() =>
    this.mode() === 'edit'
      ? 'Update the name or string pitches'
      : 'Set each string one semitone at a time',
  );
  protected readonly saveLabel = computed(() =>
    this.mode() === 'edit' ? 'Save changes' : 'Create tuning',
  );
  protected readonly nameInvalid = computed(() => this.name().trim().length === 0);

  // Render highest pitch at the top.  noteIndex runs (len-1) … 0, so the
  // stored array order (low→high) is untouched — only the view is reversed.
  // Thickness grows with the display row: top (string 1) thin → bottom thick.
  protected readonly displayRows = computed<DisplayRow[]>(() => {
    const len = this.notes().length;
    const rows: DisplayRow[] = [];
    for (let row = 0; row < len; row++) {
      rows.push({
        row,
        noteIndex: len - 1 - row,
        stringNumber: row + 1,
        weight: 1.4 + row * 0.44,
      });
    }
    return rows;
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private repeatDelay: ReturnType<typeof setTimeout> | null = null;
  private repeatInterval: ReturnType<typeof setInterval> | null = null;

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

  protected noteName(midi: number): string {
    const names = this.accidental() === 'flat' ? FLAT_NAMES : SHARP_NAMES;
    return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  }

  protected isChanged(noteIndex: number): boolean {
    const ref = this.referenceNotes();
    return ref ? ref[noteIndex] !== this.notes()[noteIndex] : false;
  }

  protected usePreset(preset: TuningPresetOption): void {
    this.name.set('');
    this.setNotes([...preset.notes]);
  }

  protected onNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.name.set(target.value);
  }

  protected onKeyboardStep(event: MouseEvent, noteIndex: number, direction: -1 | 1): void {
    if (event.detail === 0) this.step(noteIndex, direction); // keyboard activation only
  }

  protected startRepeating(event: PointerEvent, noteIndex: number, direction: -1 | 1): void {
    event.preventDefault();
    this.stopRepeating();
    this.step(noteIndex, direction);
    this.repeatDelay = setTimeout(() => {
      this.repeatInterval = setInterval(() => this.step(noteIndex, direction), 85);
    }, 420);
  }

  protected stopRepeating(): void {
    if (this.repeatDelay) clearTimeout(this.repeatDelay);
    if (this.repeatInterval) clearInterval(this.repeatInterval);
    this.repeatDelay = null;
    this.repeatInterval = null;
  }

  protected onWheel(event: WheelEvent, noteIndex: number): void {
    event.preventDefault();
    this.step(noteIndex, event.deltaY > 0 ? -1 : 1);
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.stopRepeating();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    if (!name) return;
    this.stopRepeating();
    this.save.emit({ name, notes: [...this.notes()] });
  }

  private step(noteIndex: number, direction: -1 | 1): void {
    const current = this.notes();
    const nextValue = Math.min(
      this.maxMidiNote(),
      Math.max(this.minMidiNote(), current[noteIndex] + direction),
    );
    if (nextValue === current[noteIndex]) return;

    const next = [...current];
    next[noteIndex] = nextValue;
    this.setNotes(next);
  }

  private setNotes(next: number[]): void {
    this.notes.set(next);
    this.preview.emit([...next]);
  }
}