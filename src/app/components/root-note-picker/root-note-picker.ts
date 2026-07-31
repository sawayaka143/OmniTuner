import { Component, input, output } from '@angular/core';

const ALTERNATE_NOTES: Readonly<Record<string, string>> = {
  'C#': 'D♭',
  Db: 'C♯',
  'D#': 'E♭',
  Eb: 'D♯',
  'F#': 'G♭',
  Gb: 'F♯',
  'G#': 'A♭',
  Ab: 'G♯',
  'A#': 'B♭',
  Bb: 'A♯',
};


@Component({
  selector: 'app-root-note-picker',
  templateUrl: './root-note-picker.html',
  styleUrl: './root-note-picker.scss',
})
export class RootNotePicker {
  readonly notes = input.required<readonly string[]>();
  readonly selected = input.required<string>();
  readonly open = input(false);

  readonly select = output<string>();
  readonly toggle = output<void>();
  readonly close = output<void>();

  protected alternative(note: string): string {
    return ALTERNATE_NOTES[note] ?? '';
  }
}
