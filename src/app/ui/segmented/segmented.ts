import { Component, computed, input, output } from '@angular/core';

/**
 * Segmented radiogroup with a sliding indicator. Renders one button per option
 * inside a `role="radiogroup"`; the selected option uses `role="radio"` with
 * `aria-checked`, and the indicator slides via
 * `translateX(selectedIndex * 100%)`. Defaults to `inline-flex`; pass
 * `[gridColumns]` to switch to a grid layout.
 */
@Component({
  selector: 'app-segmented',
  template: `
    <div
      class="segmented"
      [class.is-grid]="!!gridColumns()"
      [class.indicator-accent]="indicator() === 'accent'"
      [style.--seg-count]="options().length"
      [style.grid-template-columns]="gridColumns() || null"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
    >
      <span
        class="segment-indicator"
        [style.transform]="'translateX(' + selectedIndex() * 100 + '%)'"
        [class.hidden]="selectedIndex() === -1"
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
          {{ optionLabel()(option) }}
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