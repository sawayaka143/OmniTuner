import { Component, input, output } from '@angular/core';
import {
  AccidentalPreference,
  SavedTuning,
  SixStringMidiNotes,
  TuningPreset,
  TuningSelection,
} from '../../models/scale-preferences.model';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

@Component({
  selector: 'app-tuning-selector',
  templateUrl: './tuning-selector.html',
  styleUrl: './tuning-selector.scss',
})
export class TuningSelector {
  readonly presets = input.required<readonly TuningPreset[]>();
  readonly savedTunings = input.required<readonly SavedTuning[]>();
  readonly selected = input<TuningSelection | null>(null);
  readonly selectedName = input.required<string>();
  readonly accidental = input<AccidentalPreference>('sharp');
  readonly open = input(false);

  readonly select = output<TuningSelection>();
  readonly edit = output<string>();
  readonly create = output<void>();
  readonly delete = output<string>();
  readonly toggle = output<void>();

  protected isSelected(kind: TuningSelection['kind'], id: string): boolean {
    const selected = this.selected();
    return selected?.kind === kind && selected.id === id;
  }

  protected notesLabel(notes: SixStringMidiNotes): string {
    const names = this.accidental() === 'flat' ? FLAT_NAMES : SHARP_NAMES;
    return notes.map((midi) => `${names[midi % 12]}${Math.floor(midi / 12) - 1}`).join(' ');
  }
}
