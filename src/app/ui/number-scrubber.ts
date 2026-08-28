import { Directive, ElementRef, inject } from '@angular/core';

const DRAG_THRESHOLD_PX = 3;
const PX_PER_STEP = 4;
const PX_PER_STEP_FINE = 20;

@Directive({
  selector: 'input[type=number]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
  },
})
export class NumberScrubber {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private active = false;
  private scrubbing = false;
  private startY = 0;
  private startValue = 0;

  protected onPointerDown(event: PointerEvent): void {
    const input = this.el.nativeElement;
    if (event.button !== 0 || input.disabled || input.readOnly) return;
    this.active = true;
    this.scrubbing = false;
    this.startY = event.clientY;
    this.startValue = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.active) return;
    const input = this.el.nativeElement;
    const dy = this.startY - event.clientY;
    if (!this.scrubbing) {
      if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      this.scrubbing = true;
      input.setPointerCapture?.(event.pointerId);
      input.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
    }
    event.preventDefault();
    const step = this.stepSize(input);
    const pxPerStep = event.shiftKey ? PX_PER_STEP_FINE : PX_PER_STEP;
    const raw = this.startValue + (dy / pxPerStep) * step;
    this.writeValue(input, raw, step);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.active) return;
    const input = this.el.nativeElement;
    this.active = false;
    input.style.userSelect = '';
    if (!this.scrubbing) return;
    this.scrubbing = false;
    event.preventDefault();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private stepSize(input: HTMLInputElement): number {
    const step = Number(input.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  private writeValue(input: HTMLInputElement, raw: number, step: number): void {
    const stepped = Math.round(raw / step) * step;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);
    const clamped = Math.min(Math.max(stepped, min), max);
    if (input.valueAsNumber === clamped) return;
    input.value = String(clamped);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
