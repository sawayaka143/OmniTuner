import { DestroyRef, DOCUMENT, Directive, ElementRef, inject, output } from '@angular/core';

const SHEET_QUERY = '(max-width: 760px)';
const DRAG_START_PX = 8;
const DISMISS_RATIO = 0.25;
const DISMISS_MAX_PX = 120;
const DISMISS_VELOCITY_PX_PER_MS = 0.6;

@Directive({
  selector: '[appSheetSwipe]',
})
export class SheetSwipe {
  readonly swipeDismiss = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly view = inject(DOCUMENT).defaultView;

  private tracking = false;
  private dragging = false;
  private suppressClick = false;
  private startY = 0;
  private lastY = 0;
  private startTime = 0;
  private pointerId: number | null = null;

  constructor() {
    const host = this.host;
    const touchMove = (event: TouchEvent): void => this.onTouchMove(event);
    const touchStart = (event: TouchEvent): void => this.onTouchStart(event);
    const touchEnd = (): void => this.finish();
    const pointerDown = (event: PointerEvent): void => this.onPointerDown(event);
    const pointerMove = (event: PointerEvent): void => this.onPointerMove(event);
    const pointerUp = (event: PointerEvent): void => this.onPointerUp(event);
    const click = (event: MouseEvent): void => this.onClick(event);

    host.addEventListener('touchstart', touchStart, { passive: true });
    host.addEventListener('touchmove', touchMove, { passive: false });
    host.addEventListener('touchend', touchEnd);
    host.addEventListener('touchcancel', touchEnd);
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointermove', pointerMove);
    host.addEventListener('pointerup', pointerUp);
    host.addEventListener('pointercancel', pointerUp);
    host.addEventListener('click', click, true);

    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('touchstart', touchStart);
      host.removeEventListener('touchmove', touchMove);
      host.removeEventListener('touchend', touchEnd);
      host.removeEventListener('touchcancel', touchEnd);
      host.removeEventListener('pointerdown', pointerDown);
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerup', pointerUp);
      host.removeEventListener('pointercancel', pointerUp);
      host.removeEventListener('click', click, true);
    });
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    this.begin(event.touches[0].clientY, event.target);
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.tracking) return;
    if (this.move(event.touches[0].clientY) && event.cancelable) event.preventDefault();
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    this.pointerId = event.pointerId;
    this.begin(event.clientY, event.target);
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.pointerId !== this.pointerId || !this.tracking) {
      return;
    }
    if (this.move(event.clientY) && this.host.hasPointerCapture?.(event.pointerId) === false) {
      this.host.setPointerCapture?.(event.pointerId);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.finish();
  }

  private onClick(event: MouseEvent): void {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  }

  private begin(y: number, target: EventTarget | null): void {
    this.tracking =
      this.view?.matchMedia?.(SHEET_QUERY).matches === true && !this.isScrolled(target);
    this.dragging = false;
    this.startY = y;
    this.lastY = y;
    this.startTime = Date.now();
  }

  private move(y: number): boolean {
    this.lastY = y;
    const delta = y - this.startY;
    if (!this.dragging) {
      if (delta < -DRAG_START_PX) {
        this.tracking = false;
        return false;
      }
      if (delta < DRAG_START_PX) return false;
      this.dragging = true;
      this.host.style.transition = 'none';
    }
    this.host.style.transform = `translateY(${Math.max(0, delta)}px)`;
    return true;
  }

  private finish(): void {
    const wasDragging = this.dragging;
    this.tracking = false;
    this.dragging = false;
    if (!wasDragging) return;

    this.suppressClick = true;
    this.view?.setTimeout(() => (this.suppressClick = false), 0);

    const distance = Math.max(0, this.lastY - this.startY);
    const elapsed = Math.max(1, Date.now() - this.startTime);
    const threshold = Math.min(DISMISS_MAX_PX, this.host.offsetHeight * DISMISS_RATIO);
    if (distance > threshold || distance / elapsed > DISMISS_VELOCITY_PX_PER_MS) {
      this.host.style.transition = '';
      this.swipeDismiss.emit();
      return;
    }

    this.host.style.transition = 'transform var(--dur-slow) var(--ease-spring)';
    this.host.style.transform = '';
    const reset = (): void => {
      this.host.style.transition = '';
      this.host.removeEventListener('transitionend', reset);
    };
    this.host.addEventListener('transitionend', reset);
  }

  private isScrolled(target: EventTarget | null): boolean {
    let node = target instanceof Element ? target : null;
    while (node) {
      if (node.scrollTop > 0) return true;
      if (node === this.host) return false;
      node = node.parentElement;
    }
    return false;
  }
}
