import { Component, input } from '@angular/core';

@Component({
  selector: 'app-pitch-display',
  templateUrl: './pitch-display.html',
  styleUrl: './pitch-display.scss',
})
export class PitchDisplay {
  readonly noteName = input<string | null>(null);
  readonly octave = input<number | null>(null);
  readonly hz = input<string>('\u2014 Hz');
  readonly centsOffset = input<string>('\u2014');
  readonly statusMessage = input('READY TO TUNE');
  readonly isLocked = input(false);
  readonly isTuned = input(false);
}
