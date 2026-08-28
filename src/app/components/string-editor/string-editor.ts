import { Component, computed, effect, input, output, signal } from '@angular/core';
import { midiDisplayName } from '../../data/note-display-names';
import { AccidentalPreference } from '../../models/scale-preferences.model';
import {
  MAX_CUSTOM_INSTRUMENT_NAME_LENGTH,
  MAX_STRING_COUNT,
  MAX_TUNER_MIDI_NOTE,
  MIN_STRING_COUNT,
  MIN_TUNER_MIDI_NOTE,
} from '../../models/tuner-preferences.model';
import { PillButton } from '../../ui/pill-button/pill-button';
import { StepButton } from '../../ui/step-button/step-button';
import { TextField } from '../../ui/text-field/text-field';

export interface PresetOption {
  readonly id: unknown;
  readonly name: string;
  readonly notes: readonly number[];
}

export interface StringEditorValue {
  readonly name: string;
  readonly notes: readonly number[];
}

interface DisplayRow {
  readonly row: number;
  readonly noteIndex: number;
  readonly stringNumber: number;
  readonly weight: number;
}

@Component({
  selector: 'app-string-editor',
  templateUrl: './string-editor.html',
  styleUrl: './string-editor.scss',
  imports: [PillButton, StepButton, TextField],
})
export class StringEditor {
  readonly mode = input<'create' | 'edit'>('create');

  readonly initialName = input('');
  readonly initialNotes = input<readonly number[]>([]);
  readonly initialStringCount = input<number>();

  readonly minNote = input(MIN_TUNER_MIDI_NOTE);
  readonly maxNote = input(MAX_TUNER_MIDI_NOTE);
  readonly maxNameLength = input(MAX_CUSTOM_INSTRUMENT_NAME_LENGTH);
  readonly minStringCount = input(MIN_STRING_COUNT);
  readonly maxStringCount = input(MAX_STRING_COUNT);
  readonly allowCountChange = input(false);
  readonly accidental = input<AccidentalPreference>('sharp');

  readonly presets = input<readonly PresetOption[]>([]);
  readonly referenceNotes = input<readonly number[] | null>(null);
  readonly disallowedNames = input<readonly string[]>([]);
  readonly externalError = input<string>();

  readonly nameLabel = input('Instrument name');
  readonly stringsGroupLabel = input('Default tuning notes');
  readonly cancelLabel = input('Back');
  readonly createLabel = input('Create');
  readonly editLabel = input('Save changes');

  readonly save = output<StringEditorValue>();
  readonly preview = output<readonly number[]>();
  readonly cancel = output<void>();

  protected readonly name = signal('');
  protected readonly stringCount = signal(6);
  protected readonly notes = signal<number[]>([]);
  protected readonly nameError = signal('');

  protected readonly saveLabel = computed(() =>
    this.mode() === 'edit' ? this.editLabel() : this.createLabel(),
  );

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

  protected readonly effectiveError = computed(() => this.externalError() || this.nameError());

  constructor() {
    effect(() => {
      const name = this.initialName();
      const notes = this.initialNotes();
      const count = this.initialStringCount() ?? notes.length;
      void this.mode();
      this.name.set(name);
      this.notes.set([...notes]);
      this.stringCount.set(count || this.minStringCount());
      this.nameError.set('');
    });
  }

  protected noteName(midi: number): string {
    return midiDisplayName(midi, this.accidental());
  }

  protected isChanged(noteIndex: number): boolean {
    const ref = this.referenceNotes();
    return ref ? ref[noteIndex] !== this.notes()[noteIndex] : false;
  }

  protected onNameInput(value: string): void {
    this.name.set(value);
    this.nameError.set('');
  }

  protected applyPreset(preset: PresetOption): void {
    this.name.set('');
    this.setNotes([...preset.notes]);
    this.stringCount.set(preset.notes.length);
  }

  protected setStringCount(next: number): void {
    const clamped = Math.min(this.maxStringCount(), Math.max(this.minStringCount(), next));
    if (clamped === this.stringCount()) return;
    const current = this.notes();
    const rebuilt: number[] = [];
    for (let i = 0; i < clamped; i++) {
      rebuilt.push(i < current.length ? current[i] : this.defaultNoteForIndex(i));
    }
    this.stringCount.set(clamped);
    this.setNotes(rebuilt);
  }

  protected onStep(noteIndex: number, nextValue: number): void {
    if (nextValue === this.notes()[noteIndex]) return;
    const next = [...this.notes()];
    next[noteIndex] = nextValue;
    this.setNotes(next);
  }

  protected onWheel(event: WheelEvent, noteIndex: number): void {
    event.preventDefault();
    const direction: -1 | 1 = event.deltaY > 0 ? -1 : 1;
    const current = this.notes()[noteIndex];
    const nextValue = Math.min(this.maxNote(), Math.max(this.minNote(), current + direction));
    if (nextValue !== current) this.onStep(noteIndex, nextValue);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const trimmed = this.name().trim();
    if (!trimmed) {
      this.nameError.set('Enter a name.');
      return;
    }
    const lower = trimmed.toLowerCase();
    if (this.disallowedNames().some((n) => n.toLowerCase() === lower)) {
      this.nameError.set('A name like this already exists.');
      return;
    }
    this.save.emit({ name: trimmed, notes: [...this.notes()] });
  }

  protected requestCancel(): void {
    this.cancel.emit();
  }

  private setNotes(next: number[]): void {
    this.notes.set(next);
    this.preview.emit([...next]);
  }

  private defaultNoteForIndex(index: number): number {
    return Math.min(this.maxNote(), Math.max(this.minNote(), 40 + index * 5));
  }
}
