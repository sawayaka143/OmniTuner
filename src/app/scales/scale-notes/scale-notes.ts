import { Component, input, output } from '@angular/core';
import { textColorOn } from '../../data/interval-colors';
import { ScaleTone } from '../../models/scale.model';

@Component({
  selector: 'app-scale-notes',
  templateUrl: './scale-notes.html',
  styleUrl: './scale-notes.scss',
})
export class ScaleNotes {
  readonly tones = input.required<readonly ScaleTone[]>();
  readonly activePitchClass = input<number | null>(null);
  readonly play = output<ScaleTone>();

  protected readonly textColorOn = textColorOn;
}
