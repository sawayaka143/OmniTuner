import { Component, computed, input, output } from '@angular/core';

import { PressRepeat } from '../press-repeat';

@Component({
  selector: 'app-step-button',
  template: `
    <button
      type="button"
      class="step-button"
      [disabled]="isDisabled()"
      [attr.aria-label]="ariaLabel()"
      [appPressRepeat]="onStep"
    >
      <span aria-hidden="true">{{ direction() === -1 ? '−' : '+' }}</span>
    </button>
  `,
  styleUrl: './step-button.scss',
  imports: [PressRepeat],
})
export class StepButton {
  readonly direction = input.required<-1 | 1>();
  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false);

  readonly step = output<number>();

  protected readonly atLimit = computed(() =>
    this.direction() === -1 ? this.value() <= this.min() : this.value() >= this.max(),
  );

  protected readonly isDisabled = computed(() => this.disabled() || this.atLimit());

  protected readonly onStep = (): void => {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + this.direction()));
    if (next !== this.value()) this.step.emit(next);
  };
}