import { Component, input } from '@angular/core';
import { IntervalEntry } from '../../models/scale.model';
import { colorForLabel, textColorOn } from '../../data/interval-colors';

/**
 * Presentational legend of the interval labels active in the current scale.
 * Each swatch is colored via the central label→color map and labelled with its
 * interval name; the root is highlighted. The component owns no logic beyond
 * resolving colors and de-duplicating identical labels.
 */
@Component({
  selector: 'app-interval-legend',
  templateUrl: './interval-legend.html',
  styleUrl: './interval-legend.scss',
})
export class IntervalLegend {
  /** Active intervals (the container already de-duplicates by label). */
  readonly intervals = input.required<IntervalEntry[]>();

  protected readonly colorForLabel = colorForLabel;
  protected readonly textColorOn = textColorOn;

  /** Whether an interval is the root. */
  protected isRoot(interval: IntervalEntry): boolean {
    return interval.label === 'R' || interval.label === '1';
  }
}
