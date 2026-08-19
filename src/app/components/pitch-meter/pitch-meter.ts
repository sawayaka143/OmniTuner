import { Component, computed, input } from '@angular/core';

export interface Tick {
  leftPos: string;
  type: 'normal' | 'major' | 'center';
}

interface MeterLabel {
  leftPos: string;
  text: string;
  center: boolean;
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
  /** Unclamped cents deviation; null while no pitch is detected. */
  readonly cents = input<number | null>(null);

  protected readonly labels: readonly MeterLabel[] = [
    { leftPos: '0%', text: '-50', center: false },
    { leftPos: '25%', text: '-25', center: false },
    { leftPos: '50%', text: '0', center: true },
    { leftPos: '75%', text: '+25', center: false },
    { leftPos: '100%', text: '+50', center: false },
  ];

  /** Clamped to the meter's ±50¢ scale so aria-valuenow stays in range. */
  protected readonly ariaNow = computed(() => Math.max(-50, Math.min(50, this.cents() ?? 0)));
}
