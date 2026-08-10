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
import { Instrument } from '../../models/instrument.model';
import {
  MAX_STRING_COUNT,
  MAX_TUNER_MIDI_NOTE,
  MIN_STRING_COUNT,
  MIN_TUNER_MIDI_NOTE,
} from '../../models/tuner-preferences.model';
import { InstrumentRegistry } from '../../services/instrument-registry';
import { StringEditor, StringEditorValue } from '../string-editor/string-editor';
import { IconButton } from '../../ui/icon-button/icon-button';

type ManagerMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-instrument-manager',
  templateUrl: './instrument-manager.html',
  styleUrl: './instrument-manager.scss',
  imports: [StringEditor, IconButton],
})
export class InstrumentManager {
  private readonly registry = inject(InstrumentRegistry);

  readonly open = input(false);
  readonly openInCreateMode = input(false);
  readonly dismiss = output<void>();

  protected readonly minStringCount = MIN_STRING_COUNT;
  protected readonly maxStringCount = MAX_STRING_COUNT;
  protected readonly minMidiNote = MIN_TUNER_MIDI_NOTE;
  protected readonly maxMidiNote = MAX_TUNER_MIDI_NOTE;

  protected readonly instruments = this.registry.instruments;
  protected readonly mode = signal<ManagerMode>('list');
  protected readonly editingId = signal<string | null>(null);
  protected readonly externalError = signal('');

  // Initial values fed to the composite. startCreate/startEdit push new values
  // here; the composite's effect re-inits its internal state from these.
  protected readonly initialName = signal('');
  protected readonly initialNotes = signal<readonly number[]>([]);
  protected readonly initialStringCount = signal(MIN_STRING_COUNT);

  /** Names already in use by other custom instruments (excludes the one being edited). */
  protected readonly disallowedNames = computed<readonly string[]>(() =>
    this.registry
      .instruments()
      .filter((inst) => inst.kind === 'custom' && inst.id !== this.editingId())
      .map((inst) => inst.label),
  );

  /** `'create' | 'edit'` view of the current mode (never `'list'`), for the composite binding. */
  protected readonly editorMode = computed<'create' | 'edit'>(() =>
    this.mode() === 'edit' ? 'edit' : 'create',
  );

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

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) dialog.showModal();
        // Jump straight into the create form when requested (e.g. via the
        // tuner's "+" button). Reset so a later list-mode open isn't affected.
        if (this.openInCreateMode()) this.startCreate();
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
    this.externalError.set('');
    this.initialName.set('');
    this.initialStringCount.set(6);
    this.initialNotes.set(this.defaultNotes(6));
  }

  protected startEdit(instrument: Instrument): void {
    this.mode.set('edit');
    this.editingId.set(instrument.id);
    this.externalError.set('');
    this.initialName.set(instrument.label);
    this.initialStringCount.set(instrument.stringCount);
    const defaultTuning = instrument.tunings[0];
    const notes = defaultTuning
      ? defaultTuning.strings.map((s) => this.freqToMidi(s.freq))
      : this.defaultNotes(instrument.stringCount);
    this.initialNotes.set(notes);
  }

  protected backToList(): void {
    this.mode.set('list');
    this.editingId.set(null);
  }

  protected deleteInstrument(instrument: Instrument): void {
    this.registry.deleteInstrument(instrument.id);
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.mode.set('list');
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }

  /** Composite emitted save — push to the registry, surface throws as `[externalError]`. */
  protected saveFromComposite(value: StringEditorValue): void {
    this.externalError.set('');
    const editId = this.editingId();
    try {
      if (this.mode() === 'edit' && editId) {
        this.registry.updateInstrument(editId, value.name, value.notes.length, value.notes);
      } else {
        this.registry.createInstrument(value.name, value.notes.length, value.notes);
      }
      this.backToList();
    } catch (err) {
      this.externalError.set(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Standard-guitar-like spacing: E2 + perfect fourths. Reused by the composite's init. */
  private defaultNotes(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.defaultNoteForIndex(i));
    }
    return result;
  }

  private defaultNoteForIndex(index: number): number {
    return Math.min(this.maxMidiNote, Math.max(this.minMidiNote, 40 + index * 5));
  }

  private freqToMidi(freq: number): number {
    return Math.round(69 + 12 * Math.log2(freq / 440));
  }
}