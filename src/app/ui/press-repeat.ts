import { DestroyRef, Directive, inject, input } from '@angular/core';

@Directive({
  selector: '[appPressRepeat]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'stop()',
    '(pointerleave)': 'stop()',
    '(pointercancel)': 'stop()',
    '(click)': 'onHostClick($event)',
  },
})
export class PressRepeat {
  readonly appPressRepeat = input.required<() => void>();

  readonly initialDelay = input(420);

  readonly interval = input(85);

  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.stop();
    this.fire();
    this.delayTimer = setTimeout(() => {
      this.intervalTimer = setInterval(() => this.fire(), this.interval());
    }, this.initialDelay());
  }

  protected onHostClick(event: MouseEvent): void {
    if (event.detail === 0) {
      this.fire();
    }
  }

  protected stop(): void {
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private fire(): void {
    this.appPressRepeat()();
  }
}
