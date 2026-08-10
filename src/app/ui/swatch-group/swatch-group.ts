import { Component, input, output } from '@angular/core';

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
    <div class="swatches" role="radiogroup" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track trackByFn()(option)) {
        <button
          type="button"
          class="swatch"
          role="radio"
          [class.selected]="isSelected(option)"
          [attr.aria-checked]="isSelected(option)"
          [attr.aria-label]="ariaLabelFor()(option)"
          [title]="ariaLabelFor()(option)"
          [style.--swatch-color]="swatchColor()(option)"
          (click)="select.emit(option)"
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

  protected isSelected(option: T): boolean {
    return this.compareWith()(this.value(), option);
  }
}