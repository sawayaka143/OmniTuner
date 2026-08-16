import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

/**
 * Radiogroup of color swatches. Each option renders as a square button with
 * a colored dot inside; the selected swatch gets a tinted ring. Used by the
 * settings panel for accent color and in-tune color pickers.
 *
 * `compareWith` defaults to identity but can be overridden for case-insensitive
 * comparison (the accent color picker compares `.toLowerCase()`).
 */
@Component({
  selector: 'app-swatch-group',
  template: `
    <div
      #group
      class="swatches"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      (keydown)="onKeydown($event)"
    >
      @for (option of options(); track trackByFn()(option); let i = $index) {
        <button
          type="button"
          class="swatch"
          role="radio"
          [class.selected]="isSelected(option)"
          [attr.aria-checked]="isSelected(option)"
          [attr.aria-label]="ariaLabelFor()(option)"
          [title]="ariaLabelFor()(option)"
          [style.--swatch-color]="swatchColor()(option)"
          [tabindex]="tabIndexFor(i)"
          (click)="select.emit(option)"
          (focus)="onFocus(i)"
        >
          <span aria-hidden="true"></span>
        </button>
      }
    </div>
  `,
  styleUrl: './swatch-group.scss',
})
export class SwatchGroup<T> {
  readonly options = input.required<readonly T[]>();
  readonly value = input.required<T>();
  readonly ariaLabel = input.required<string>();
  readonly swatchColor = input.required<(o: T) => string>();
  readonly ariaLabelFor = input.required<(o: T) => string>();
  readonly trackByFn = input.required<(o: T) => unknown>();
  readonly compareWith = input((a: T, b: T) => a === b);

  readonly select = output<T>();

  private readonly group = viewChild<ElementRef<HTMLElement>>('group');
  private readonly focusIndex = signal<number | null>(null);

  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((o) => this.compareWith()(this.value(), o)),
  );

  protected tabIndexFor(i: number): number {
    const focused = this.focusIndex();
    if (focused !== null) return focused === i ? 0 : -1;
    const sel = this.selectedIndex();
    return (sel === -1 ? 0 : sel) === i ? 0 : -1;
  }

  protected onFocus(i: number): void {
    this.focusIndex.set(i);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const btns = [
      ...(this.group()?.nativeElement.querySelectorAll<HTMLButtonElement>('button[role="radio"]') ??
        []),
    ];
    if (btns.length === 0) return;
    const current = btns.indexOf(event.target as HTMLButtonElement);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = Math.min(current + 1, btns.length - 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(current - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = btns.length - 1;
    else return;
    event.preventDefault();
    btns[next]?.focus();
    btns[next]?.click();
  }

  protected isSelected(option: T): boolean {
    return this.compareWith()(this.value(), option);
  }
}
