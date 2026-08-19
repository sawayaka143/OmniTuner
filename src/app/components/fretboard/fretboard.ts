import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  viewChild,
} from '@angular/core';
import { FretCell } from '../../models/scale.model';
import { LabelMode } from '../../models/scale-preferences.model';
import { textColorOn } from '../../data/interval-colors';

/**
 * Presentational fretboard visualizer: renders a pre-computed `FretCell[][]`
 * (rows = strings, high-string-first) as a CSS grid. In-scale cells show a
 * colored dot from the resolved interval label; the root is larger with a
 * halo. No music-theory math — every value is already on each `FretCell`.
 */
@Component({
  selector: 'app-fretboard',
  templateUrl: './fretboard.html',
  styleUrl: './fretboard.scss',
})
export class Fretboard {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly ngZone = inject(NgZone);
  private readonly scaleContainer = viewChild.required<ElementRef<HTMLElement>>('scaleContainer');
  private readonly scaleFrame = viewChild.required<ElementRef<HTMLElement>>('scaleFrame');
  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame: number | null = null;
  private destroyed = false;

  /** Rows of cells, high-string-first (index 0 = highest string = top). */
  readonly cells = input.required<FretCell[][]>();
  /** Number of frets to render (excluding the open-string column). */
  readonly fretCount = input.required<number>();
  /** Display label for the current scale, used in the aria description. */
  readonly scaleLabel = input.required<string>();
  /** Display label for the current root note, used in the aria description. */
  readonly rootLabel = input.required<string>();
  readonly labelMode = input<LabelMode>('note-names');
  readonly showOutsideScale = input(false);
  readonly activeCell = input<FretCell | null>(null);

  readonly play = output<FretCell>();
  readonly inspect = output<FretCell | null>();

  constructor() {
    afterNextRender(() => {
      this.ngZone.runOutsideAngular(() => {
        this.observeContainer();
        this.observeFonts();
        this.scheduleScaleUpdate();
      });
    });

    afterRenderEffect(() => {
      this.cells();
      this.fretCount();
      this.labelMode();
      this.showOutsideScale();
      this.scheduleScaleUpdate();
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
      this.document.fonts?.removeEventListener('loadingdone', this.handleFontsLoaded);

      const view = this.document.defaultView;
      if (view && this.resizeFrame !== null) {
        view.cancelAnimationFrame(this.resizeFrame);
      }
    });
  }

  /** Fret numbers 0..fretCount, used for the header labels. */
  protected readonly fretNumbers = computed(() => {
    const count = this.fretCount();
    return Array.from({ length: count + 1 }, (_, i) => i);
  });

  /** Standard fretboard inlay positions, with paired markers at each octave. */
  protected readonly singleInlays = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
  protected readonly doubleInlays = new Set([12, 24]);

  /** Returns a readable text color (AA-safe) for a dot's background color. */
  protected readonly textColorOn = textColorOn;

  private readonly handleFontsLoaded = (): void => {
    this.scheduleScaleUpdate();
  };

  private observeContainer(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleScaleUpdate();
    });
    this.resizeObserver.observe(this.scaleContainer().nativeElement);
  }

  private observeFonts(): void {
    const fontSet = this.document.fonts;
    if (!fontSet) return;

    void fontSet.ready.then(this.handleFontsLoaded);
    fontSet.addEventListener('loadingdone', this.handleFontsLoaded);
  }

  private scheduleScaleUpdate(): void {
    if (this.destroyed) return;

    this.ngZone.runOutsideAngular(() => {
      const view = this.document.defaultView;
      if (!view) return;

      if (this.resizeFrame !== null) {
        view.cancelAnimationFrame(this.resizeFrame);
      }

      this.resizeFrame = view.requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.updateScale();
      });
    });
  }

  private updateScale(): void {
    const container = this.scaleContainer().nativeElement;
    const frame = this.scaleFrame().nativeElement;
    const board = this.board().nativeElement;
    const styles = this.document.defaultView?.getComputedStyle(container);

    if (!styles) return;

    const horizontalPadding =
      (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
    const availableWidth = container.clientWidth - horizontalPadding;
    const naturalWidth = board.offsetWidth;
    const naturalHeight = board.offsetHeight;

    if (availableWidth <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;

    const scale = Math.min(1, availableWidth / naturalWidth);
    frame.style.width = `${naturalWidth * scale}px`;
    frame.style.height = `${naturalHeight * scale}px`;
    board.style.transform = `scale(${scale})`;
  }
}
