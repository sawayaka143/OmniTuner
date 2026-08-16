import { Component, computed, input, output } from '@angular/core';

/**
 * Segmented control component (radio group) with a sliding active indicator.
 * Supports both inline-flex (default) and grid layouts via the `gridColumns` input.
 */
@Component({
  selector: 'app-segmented',
  template: `
    <div
      class="segmented"
      [class.is-grid]="!!gridColumns()"
      [class.compact]="compact()"
      [class.indicator-accent]="indicator() === 'accent'"
      [style.--seg-count]="options().length"
      [style.grid-template-columns]="gridColumns() || null"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
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
      @for (option of options(); track trackByFn()(option)) {
        <button
          type="button"
          role="radio"
          [class.active]="isSelected(option)"
          [attr.aria-checked]="isSelected(option)"
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
}
