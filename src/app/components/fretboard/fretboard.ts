import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
  untracked,
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
  private shrinkTimer: ReturnType<typeof setTimeout> | null = null;
  private previousFretCount = 0;
  private destroyed = false;

  private readonly SHRINK_DELAY_MS = 250;

  private readonly displayedFretCountInternal = signal<number | null>(null);
  protected readonly displayedFretCount = computed(() => {
    const pending = this.displayedFretCountInternal();
    return pending ?? this.fretCount();
  });

  protected readonly fretNumbers = computed(() => {
    const count = this.displayedFretCount();
    return Array.from({ length: count + 1 }, (_, i) => i);
  });

  private readonly cachedCells = signal<FretCell[][]>([]);

  protected readonly displayedCells = computed<FretCell[][]>(() => {
    const current = this.cells();
    const displayed = this.displayedFretCount();
    const target = this.fretCount();

    if (displayed <= target) return current;

    const cached = this.cachedCells();
    if (cached.length === 0) return current;

    return current.map((row, idx) => {
      const cachedRow = cached[idx];
      if (!cachedRow) return row;
      const extra = cachedRow.slice(target + 1, displayed + 1);
      return [...row, ...extra];
    });
  });

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

    effect(() => {
      const target = this.fretCount();
      const displayed = this.displayedFretCount();
      if (target === displayed) {
        untracked(() => {
          this.previousFretCount = displayed;
          if (this.shrinkTimer) {
            clearTimeout(this.shrinkTimer);
            this.shrinkTimer = null;
          }
          this.displayedFretCountInternal.set(null);
        });
        return;
      }

      if (target > displayed) {
        untracked(() => {
          if (this.shrinkTimer) {
            clearTimeout(this.shrinkTimer);
            this.shrinkTimer = null;
          }
          this.previousFretCount = displayed;
          this.displayedFretCountInternal.set(target);
          this.scheduleScaleUpdate();
        });
        return;
      }

      untracked(() => {
        this.cachedCells.set(this.cells());
        this.previousFretCount = displayed;
        if (this.shrinkTimer) clearTimeout(this.shrinkTimer);
        if (this.prefersReducedMotion()) {
          this.displayedFretCountInternal.set(target);
          this.scheduleScaleUpdate();
          return;
        }
        if (this.displayedFretCountInternal() === null) {
          this.displayedFretCountInternal.set(displayed);
        }
        this.shrinkTimer = setTimeout(() => {
          this.shrinkTimer = null;
          this.displayedFretCountInternal.set(target);
          this.scheduleScaleUpdate();
        }, this.SHRINK_DELAY_MS);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
      this.document.fonts?.removeEventListener('loadingdone', this.handleFontsLoaded);
      if (this.shrinkTimer) clearTimeout(this.shrinkTimer);

      const view = this.document.defaultView;
      if (view && this.resizeFrame !== null) {
        view.cancelAnimationFrame(this.resizeFrame);
      }
    });
  }

  /** Standard fretboard inlay positions, with paired markers at each octave. */
  protected readonly singleInlays = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
  protected readonly doubleInlays = new Set([12, 24]);

  /** Returns a readable text color (AA-safe) for a dot's background color. */
  protected readonly textColorOn = textColorOn;

  protected isFretEntering(fret: number): boolean {
    return fret > this.previousFretCount && fret <= this.fretCount() && this.fretCount() > this.previousFretCount;
  }

  protected isFretExiting(fret: number): boolean {
    return fret > this.fretCount() && fret <= this.displayedFretCount();
  }

  private prefersReducedMotion(): boolean {
    try {
      return !!this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

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

    const usesFluidGrid = getComputedStyle(board).gridTemplateColumns.includes('1fr');
    if (usesFluidGrid) {
      frame.style.width = '100%';
      frame.style.height = 'auto';
      board.style.transform = 'none';
      return;
    }

    const scale = Math.min(1, availableWidth / naturalWidth);
    frame.style.width = `${naturalWidth * scale}px`;
    frame.style.height = `${naturalHeight * scale}px`;
    board.style.transform = `scale(${scale})`;
  }
}
