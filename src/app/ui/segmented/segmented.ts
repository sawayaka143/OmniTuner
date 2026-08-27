import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-segmented',
  template: `
    <div
      #group
      class="segmented"
      [class.is-grid]="!!gridColumns()"
      [class.compact]="compact()"
      [class.indicator-accent]="indicator() === 'accent'"
      [style.--seg-count]="options().length"
      [style.--seg-gap]="compact() ? '2px' : null"
      [style.grid-template-columns]="gridColumns() || null"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      (keydown)="onKeydown($event)"
    >
      <span
        class="segment-indicator"
        [class.hidden]="selectedIndex() === -1"
        [style.transform]="
          selectedIndex() === -1
            ? 'translateX(-100%)'
            : 'translateX(calc(' +
              selectedIndex() +
              ' * 100% + ' +
              selectedIndex() +
              ' * var(--seg-gap, 0px)))'
        "
        aria-hidden="true"
      ></span>
      @for (option of options(); track trackByFn()(option); let i = $index) {
        <button
          type="button"
          role="radio"
          [class.active]="isSelected(option)"
          [attr.aria-checked]="isSelected(option)"
          [disabled]="disabled()"
          [tabindex]="tabIndexFor(i)"
          (click)="select.emit(option)"
          (focus)="onFocus(i)"
        >
          <span class="seg-label">{{ optionLabel()(option) }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './segmented.scss',
})
export class Segmented<T> {
  readonly options = input.required<readonly T[]>();
  readonly value = input.required<T>();
  readonly ariaLabel = input.required<string>();
  readonly indicator = input<'plain' | 'accent'>('plain');
  readonly optionLabel = input.required<(o: T) => string>();
  readonly trackByFn = input.required<(o: T) => unknown>();
  readonly compareWith = input((a: T, b: T) => a === b);
  readonly gridColumns = input<string>();
  readonly compact = input(false);
  readonly disabled = input(false);

  readonly select = output<T>();

  protected readonly group = viewChild<ElementRef<HTMLElement>>('group');
  private readonly focusIndex = signal<number | null>(null);

  protected readonly selectedIndex = computed(() => {
    const value = this.value();
    const options = this.options();
    const cmp = this.compareWith();
    for (let i = 0; i < options.length; i++) {
      if (cmp(options[i], value)) return i;
    }
    return -1;
  });

  protected isSelected(option: T): boolean {
    return this.compareWith()(this.value(), option);
  }

  protected tabIndexFor(index: number): number {
    const focused = this.focusIndex();
    if (focused !== null) return focused === index ? 0 : -1;
    const sel = this.selectedIndex();
    return (sel === -1 ? 0 : sel) === index ? 0 : -1;
  }

  protected onFocus(index: number): void {
    this.focusIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const btns = [
      ...(this.group()?.nativeElement.querySelectorAll<HTMLButtonElement>('button[role="radio"]') ??
        []),
    ].filter((b) => !b.disabled);
    if (btns.length === 0) return;
    const currentIdx = btns.indexOf(event.target as HTMLButtonElement);
    const lastIdx = btns.length - 1;

    let next: HTMLButtonElement | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      next = btns[Math.min(currentIdx + 1, lastIdx)] ?? null;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      next = btns[Math.max(currentIdx - 1, 0)] ?? null;
    } else if (event.key === 'Home') {
      event.preventDefault();
      next = btns[0] ?? null;
    } else if (event.key === 'End') {
      event.preventDefault();
      next = btns[lastIdx] ?? null;
    }
    if (next) {
      next.focus();
      next.click();
    }
  }
}
