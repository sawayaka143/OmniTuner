import { Component, computed, input } from '@angular/core';
import { DEGREE_LABELS, midiName, pcName } from '../../utils/chord-theory';

const NECK = { ROW: 24, COL: 30, LEFT: 40, IND: 26, RIGHT: 34, PAD: 8, TOP: 24, BOT: 18 } as const;

const INLAY_SINGLE = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const INLAY_DOUBLE = new Set([12, 24]);

const FUNC_COLOR: Readonly<Record<number, string>> = {
  0: 'var(--neck-root)',
  3: 'var(--neck-third)',
  4: 'var(--neck-third)',
  5: 'var(--neck-fifth)',
  7: 'var(--neck-fifth)',
  6: 'var(--neck-alt)',
  8: 'var(--neck-alt)',
  10: 'var(--neck-alt)',
  11: 'var(--neck-alt)',
};
const OTHER_COLOR = 'var(--neck-other)';

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

export type DiagramView = 'dots' | 'lines';
export type DiagramLabelMode = 'notes' | 'func';

interface Wire {
  readonly x: number;
  readonly kind: 'nut' | 'edge' | 'inner';
}

interface Marker {
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly isRoot: boolean;

  readonly inner: string;

  readonly edge: string;
}

interface MutedMarker {
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-neck-diagram',
  templateUrl: './neck-diagram.html',
  styleUrl: './neck-diagram.scss',
})
export class NeckDiagram {
  readonly frets = input.required<readonly (number | null)[]>();
  readonly tuningMidi = input.required<readonly number[]>();
  readonly tuningLabels = input.required<readonly string[]>();
  readonly symbol = input.required<string>();
  readonly rootPc = input.required<number>();
  readonly index = input(0);
  readonly view = input<DiagramView>('lines');
  readonly labelMode = input<DiagramLabelMode>('notes');
  readonly flats = input(false);

  protected readonly layout = computed(() => {
    const frets = this.frets();
    const n = this.tuningMidi().length;
    const fretted = frets.filter((f): f is number => f !== null && f > 0);
    const lo = fretted.length ? Math.max(1, Math.min(...fretted)) : 1;
    const hi = Math.max(fretted.length ? Math.max(...fretted) : lo, lo + 3);
    const cols = hi - lo + 1;
    const gridL = NECK.LEFT + NECK.IND;
    const gridR = gridL + cols * NECK.COL;
    const width = gridR + NECK.RIGHT + NECK.PAD;
    const height = NECK.TOP + n * NECK.ROW + NECK.BOT;
    const yTop = NECK.TOP;
    const yBot = NECK.TOP + n * NECK.ROW;
    return {
      n,
      lo,
      cols,
      gridL,
      gridR,
      width,
      height,
      yTop,
      yBot,
      indCx: NECK.LEFT + NECK.IND / 2,
      stringY: (s: number): number => yTop + (n - 1 - s) * NECK.ROW + NECK.ROW / 2,
      fretX: (f: number): number => gridL + (f - lo) * NECK.COL + NECK.COL / 2,
    };
  });

  protected readonly wires = computed<readonly Wire[]>(() => {
    const { cols, gridL, lo } = this.layout();
    const wires: Wire[] = [];
    for (let k = 0; k <= cols; k++) {
      const x = gridL + k * NECK.COL;
      const kind = k === 0 ? (lo === 1 ? 'nut' : 'edge') : 'inner';
      wires.push({ x, kind });
    }
    return wires;
  });

  protected readonly inlays = computed(() => {
    const { lo, cols, yTop, yBot, fretX } = this.layout();
    const dots: { cx: number; cy: number }[] = [];
    for (let f = lo; f < lo + cols; f++) {
      const cx = fretX(f);
      if (INLAY_SINGLE.has(f)) dots.push({ cx, cy: (yTop + yBot) / 2 });
      else if (INLAY_DOUBLE.has(f)) {
        dots.push({ cx, cy: yTop + 0.3 * (yBot - yTop) });
        dots.push({ cx, cy: yTop + 0.7 * (yBot - yTop) });
      }
    }
    return dots;
  });

  protected readonly strings = computed(() => {
    const { n, stringY } = this.layout();
    return Array.from({ length: n }, (_, s) => ({ y: stringY(s) }));
  });

  protected readonly stringLabels = computed(() => {
    const { n, stringY } = this.layout();
    const frets = this.frets();
    const labels = this.tuningLabels();
    return Array.from({ length: n }, (_, s) => ({
      y: stringY(s),
      text: labels[s],
      muted: frets[s] === null,
    }));
  });

  protected readonly axisLabels = computed(() => {
    const { lo, cols, gridL, indCx, yBot } = this.layout();
    const y = yBot + NECK.BOT / 2 + 1;
    const result: { x: number; y: number; text: string }[] = [];
    if (this.frets().some((f) => f === 0)) result.push({ x: indCx, y, text: '0' });
    for (let k = 0; k <= cols; k++) {
      result.push({ x: gridL + k * NECK.COL + NECK.COL / 2, y, text: String(lo + k) });
    }
    return result;
  });

  protected readonly markers = computed(() => {
    const { stringY, fretX, indCx } = this.layout();
    const frets = this.frets();
    const tuningMidi = this.tuningMidi();
    const rootPc = this.rootPc();
    const flats = this.flats();
    const labelMode = this.labelMode();
    const dots: Marker[] = [];
    const muted: MutedMarker[] = [];
    for (let s = 0; s < frets.length; s++) {
      const fret = frets[s];
      const y = stringY(s);
      if (fret === null) {
        muted.push({ x: indCx, y });
        continue;
      }
      const midi = tuningMidi[s] + fret;
      const degree = mod12(midi - rootPc);
      const color = FUNC_COLOR[degree] ?? OTHER_COLOR;
      const x = fret === 0 ? indCx : fretX(fret);
      const noteLabel = pcName(midi, flats);
      const degreeLabel = DEGREE_LABELS[degree];
      if (this.view() === 'dots') {
        dots.push({
          x,
          y,
          color,
          isRoot: degree === 0,
          inner: labelMode === 'notes' ? noteLabel : degreeLabel,
          edge: labelMode === 'notes' ? degreeLabel : noteLabel,
        });
      } else {
        dots.push({
          x,
          y,
          color,
          isRoot: degree === 0,
          inner: String(fret),
          edge: labelMode === 'notes' ? midiName(midi, flats) : degreeLabel,
        });
      }
    }
    return { dots, muted };
  });

  protected readonly ariaLabel = computed(() => `${this.symbol()} fingering ${this.index() + 1}`);
}
