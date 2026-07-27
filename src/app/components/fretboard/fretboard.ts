import { Component, computed, input } from '@angular/core';
import { FretCell } from '../../models/scale.model';
import { textColorOn } from '../../data/interval-colors';

/**
 * Presentational fretboard visualizer.
 *
 * Renders a pre-computed `FretCell[][]` matrix (rows = strings, already oriented
 * high-string-first so row 0 is the top of the board) as a CSS grid of frets.
 * In-scale cells show a colored dot whose color comes from the cell's resolved
 * interval label; the root is rendered larger with a halo. The component performs
 * no music-theory math — every value it needs is already on each `FretCell`.
 */
@Component({
  selector: 'app-fretboard',
  templateUrl: './fretboard.html',
  styleUrl: './fretboard.scss',
})
export class Fretboard {
  /** Rows of cells, high-string-first (index 0 = highest string = top). */
  readonly cells = input.required<FretCell[][]>();
  /** Number of frets to render (excluding the open-string column). */
  readonly fretCount = input.required<number>();
  /** Display label for the current scale, used in the aria description. */
  readonly scaleLabel = input.required<string>();
  /** Display label for the current root note, used in the aria description. */
  readonly rootLabel = input.required<string>();

  /** Fret numbers 0..fretCount, used for the header labels. */
  protected readonly fretNumbers = computed(() => {
    const count = this.fretCount();
    return Array.from({ length: count + 1 }, (_, i) => i);
  });

  /** Fret positions that show a single inlay dot (3, 5, 7, 9) and a double (12). */
  protected readonly singleInlays = new Set([3, 5, 7, 9]);
  protected readonly doubleInlays = new Set([12, 15]);

  /** Returns a readable text color (AA-safe) for a dot's background color. */
  protected readonly textColorOn = textColorOn;

  protected trackByFret(index: number): number {
    return index;
  }
}
