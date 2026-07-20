import { Component, input } from '@angular/core';

export interface Tick {
  leftPos: string;
  type: 'normal' | 'major' | 'center';
}

@Component({
  selector: 'app-pitch-meter',
  templateUrl: './pitch-meter.html',
  styleUrl: './pitch-meter.scss',
})
export class PitchMeter {
  readonly ticks = input.required<Tick[]>();
  readonly needleLeft = input.required<string>();
  readonly isTuned = input(false);
}
