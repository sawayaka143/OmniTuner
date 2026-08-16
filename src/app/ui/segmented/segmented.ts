import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Segmented control component (radio group) with a sliding active indicator.
 * Supports both inline-flex (default) and grid layouts via the `gridColumns` input.
 */
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
            : 'translateX(' + selectedIndex() * 100 + '%)'
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
    return this.selectedIndex() === index ? 0 : -1;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const btns =
      this.group()?.nativeElement.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!btns || btns.length === 0) return;
    const currentIdx = [...btns].indexOf(event.target as HTMLButtonElement);
    const lastIdx = btns.length - 1;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      btns[Math.min(currentIdx + 1, lastIdx)]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      btns[Math.max(currentIdx - 1, 0)]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      btns[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      btns[lastIdx]?.focus();
    }
  }
}
