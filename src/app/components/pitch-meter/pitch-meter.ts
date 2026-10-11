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
  readonly stale = input(false);
  readonly tolerance = input<number | null>(null);

  readonly cents = input<number | null>(null);

  protected readonly labels: readonly MeterLabel[] = [
    { leftPos: '0%', text: '-50', center: false },
    { leftPos: '25%', text: '-25', center: false },
    { leftPos: '50%', text: '0', center: true },
    { leftPos: '75%', text: '+25', center: false },
    { leftPos: '100%', text: '+50', center: false },
  ];

  protected readonly toleranceZone = computed(() => {
    const tolerance = this.tolerance();
    if (tolerance === null || !Number.isFinite(tolerance) || tolerance <= 0) return null;
    const halfWidth = Math.min(50, tolerance);
    return { left: 50 - halfWidth, width: halfWidth * 2 };
  });

  protected readonly ariaNow = computed(() => Math.max(-50, Math.min(50, this.cents() ?? 0)));
}
