import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SHARP_DISPLAY_NAMES } from '../../data/note-display-names';
import { Instrument } from '../../models/instrument.model';
import {
  MAX_CUSTOM_INSTRUMENT_NAME_LENGTH,
  MAX_STRING_COUNT,
  MAX_TUNER_MIDI_NOTE,
  MIN_STRING_COUNT,
  MIN_TUNER_MIDI_NOTE,
} from '../../models/tuner-preferences.model';
import { InstrumentRegistry } from '../../services/instrument-registry';

interface DisplayRow {
  readonly row: number;
  readonly noteIndex: number;
  readonly stringNumber: number;
  readonly weight: number;
}

type ManagerMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-instrument-manager',
  templateUrl: './instrument-manager.html',
  styleUrl: './instrument-manager.scss',
})
export class InstrumentManager {
  private readonly registry = inject(InstrumentRegistry);

  readonly open = input(false);
  readonly openInCreateMode = input(false);
  readonly dismiss = output<void>();

  protected readonly instruments = this.registry.instruments;
  protected readonly maxNameLength = MAX_CUSTOM_INSTRUMENT_NAME_LENGTH;
  protected readonly minStringCount = MIN_STRING_COUNT;
  protected readonly maxStringCount = MAX_STRING_COUNT;
  protected readonly minMidiNote = MIN_TUNER_MIDI_NOTE;
  protected readonly maxMidiNote = MAX_TUNER_MIDI_NOTE;

  protected readonly mode = signal<ManagerMode>('list');
  protected readonly editingId = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly stringCount = signal(6);
  protected readonly notes = signal<number[]>([]);
  protected readonly nameError = signal('');

  protected readonly title = computed(() => {
    switch (this.mode()) {
      case 'create': return 'New instrument';
      case 'edit': return 'Edit instrument';
      default: return 'Manage instruments';
    }
  });

  protected readonly subtitle = computed(() => {
    switch (this.mode()) {
      case 'create': return 'Define a custom instrument with its own string count and default tuning';
      case 'edit': return 'Update the name, string count, or default tuning';
      default: return 'Built-in instruments are read-only. Custom instruments can be edited or removed.';
    }
  });

  protected readonly saveLabel = computed(() =>
    this.mode() === 'edit' ? 'Save changes' : 'Create instrument',
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

  protected readonly nameInvalid = computed(() => {
    const trimmed = this.name().trim();
    if (!trimmed) return true;
    return false;
  });

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private repeatDelay: ReturnType<typeof setTimeout> | null = null;
  private repeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) dialog.showModal();
        // Jump straight into the create form when requested (e.g. via the
        // tuner's "+" button). Reset so a later list-mode open isn't affected.
        if (this.openInCreateMode()) {
          this.startCreate();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected isCustom(instrument: Instrument): boolean {
    return instrument.kind === 'custom';
  }

  protected startCreate(): void {
    this.mode.set('create');
    this.editingId.set(null);
    this.name.set('');
    this.nameError.set('');
    this.stringCount.set(6);
    this.notes.set(this.defaultNotes(6));
  }

  protected startEdit(instrument: Instrument): void {
    this.mode.set('edit');
    this.editingId.set(instrument.id);
    this.name.set(instrument.label);
    this.nameError.set('');
    this.stringCount.set(instrument.stringCount);
    // Derive notes from the instrument's default tuning.
    const defaultTuning = instrument.tunings[0];
    if (defaultTuning) {
      this.notes.set(defaultTuning.strings.map((s) => this.freqToMidi(s.freq)));
    } else {
      this.notes.set(this.defaultNotes(instrument.stringCount));
    }
  }

  protected backToList(): void {
    this.stopRepeating();
    this.mode.set('list');
    this.editingId.set(null);
  }

  protected onNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.name.set(target.value);
      this.nameError.set('');
    }
  }

  protected setStringCount(count: number): void {
    const clamped = Math.min(this.maxStringCount, Math.max(this.minStringCount, count));
    if (clamped === this.stringCount()) return;

    const current = this.notes();
    const next: number[] = [];
    for (let i = 0; i < clamped; i++) {
      next.push(i < current.length ? current[i] : this.defaultNoteForIndex(i, clamped));
    }
    this.stringCount.set(clamped);
    this.notes.set(next);
  }

  protected onKeyboardStep(event: MouseEvent, noteIndex: number, direction: -1 | 1): void {
    if (event.detail === 0) this.step(noteIndex, direction);
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

  protected submit(event: Event): void {
    event.preventDefault();
    const trimmed = this.name().trim();
    if (!trimmed) {
      this.nameError.set('Enter a name for this instrument.');
      return;
    }

    // Check uniqueness among custom instruments.
    const duplicate = this.registry.instruments().some(
      (inst) =>
        inst.kind === 'custom' &&
        inst.id !== this.editingId() &&
        inst.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      this.nameError.set('An instrument with this name already exists.');
      return;
    }

    const count = this.stringCount();
    const notes = this.notes();

    try {
      const editId = this.editingId();
      if (this.mode() === 'edit' && editId) {
        this.registry.updateInstrument(editId, trimmed, count, notes);
      } else {
        this.registry.createInstrument(trimmed, count, notes);
      }
      this.backToList();
    } catch (err) {
      this.nameError.set(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  protected deleteInstrument(instrument: Instrument): void {
    this.registry.deleteInstrument(instrument.id);
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.stopRepeating();
    this.mode.set('list');
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  protected noteName(midi: number): string {
    return `${SHARP_DISPLAY_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
  }

  private step(noteIndex: number, direction: -1 | 1): void {
    const current = this.notes();
    const nextValue = Math.min(
      this.maxMidiNote,
      Math.max(this.minMidiNote, current[noteIndex] + direction),
    );
    if (nextValue === current[noteIndex]) return;

    const next = [...current];
    next[noteIndex] = nextValue;
    this.notes.set(next);
  }

  /** Sensible default: standard guitar-like spacing (E-A-D-G-B-E pattern). */
  private defaultNotes(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.defaultNoteForIndex(i, count));
    }
    return result;
  }

  private defaultNoteForIndex(index: number, total: number): number {
    // Start from E2 (40) and space by 5 semitones (perfect fourths),
    // similar to standard guitar tuning.
    return Math.min(this.maxMidiNote, Math.max(this.minMidiNote, 40 + index * 5));
  }

  private freqToMidi(freq: number): number {
    return Math.round(69 + 12 * Math.log2(freq / 440));
  }
}
