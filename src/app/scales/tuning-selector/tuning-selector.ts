import { Component, input, output } from '@angular/core';
import { AccidentalPreference } from '../../models/scale-preferences.model';
import { midiDisplayName } from '../../data/note-display-names';

export interface TuningOption {
  readonly id: string;
  readonly name: string;
  readonly notes: readonly number[];
  readonly kind: 'preset' | 'custom';
}

@Component({
  selector: 'app-tuning-selector',
  templateUrl: './tuning-selector.html',
  styleUrl: './tuning-selector.scss',
})
export class TuningSelector {
  readonly presets = input.required<readonly TuningOption[]>();
  readonly savedTunings = input.required<readonly TuningOption[]>();
  readonly selectedId = input<string | null>(null);
  readonly selectedName = input.required<string>();
  readonly accidental = input<AccidentalPreference>('sharp');
  readonly open = input(false);

  readonly select = output<string>();
  readonly edit = output<string>();
  readonly create = output<void>();
  readonly delete = output<string>();
  readonly toggle = output<void>();

  protected isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  protected notesLabel(notes: readonly number[]): string {
    return notes.map((midi) => midiDisplayName(midi, this.accidental())).join(' ');
  }
}
