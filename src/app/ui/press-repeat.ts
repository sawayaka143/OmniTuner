import { DestroyRef, Directive, inject, input } from '@angular/core';

/**
 * Press-and-hold-to-repeat: fires a callback on `pointerdown`, then again on
 * an interval after an initial delay. Keyboard activation (`click` with
 * `detail === 0`) fires once; pointer clicks are suppressed (the `pointerdown`
 * path already handled them) so the host never double-fires.
 */
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
  /** Invoked on each repeat (and once on the initial press). */
  readonly appPressRepeat = input.required<() => void>();
  /** Idle period before repeating begins, in ms. */
  readonly initialDelay = input(420);
  /** Interval between repeats after the initial delay, in ms. */
  readonly interval = input(85);

  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private pointerPressed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.pointerPressed = true;
    this.stop();
    this.fire();
    this.delayTimer = setTimeout(() => {
      this.intervalTimer = setInterval(() => this.fire(), this.interval());
    }, this.initialDelay());
  }

  protected onHostClick(event: MouseEvent): void {
    // Keyboard activation produces `detail === 0`; pointer clicks were already
    // handled in `onPointerDown`, so only respond to the keyboard.
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
    this.pointerPressed = false;
  }

  private fire(): void {
    this.appPressRepeat()();
  }
}