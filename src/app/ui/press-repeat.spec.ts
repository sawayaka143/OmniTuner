import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PressRepeat } from './press-repeat';

@Component({
  selector: 'app-pr-host',
  template: `<button type="button" [appPressRepeat]="onTick">tick</button>`,
  imports: [PressRepeat],
})
class PrHost {
  readonly count = signal(0);
  protected readonly onTick = (): void => this.count.update((n) => n + 1);
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('PressRepeat', () => {
  let fixture: ComponentFixture<PrHost>;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PrHost] }).compileComponents();
    fixture = TestBed.createComponent(PrHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('fires once immediately on pointerdown', () => {
    button.dispatchEvent(new PointerEvent('pointerdown'));
    expect(fixture.componentInstance.count()).toBe(1);
  });

  it('fires once for keyboard activation (click with detail 0)', () => {
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(fixture.componentInstance.count()).toBe(1);
  });

  it('does not double-fire on a pointer-initiated click', () => {
    button.dispatchEvent(new PointerEvent('pointerdown'));
    button.dispatchEvent(new MouseEvent('click', { detail: 1 }));
    expect(fixture.componentInstance.count()).toBe(1);
  });

  it('repeats after the initial delay and on each interval', () => {
    vi.useFakeTimers();
    try {
      button.dispatchEvent(new PointerEvent('pointerdown'));
      expect(fixture.componentInstance.count()).toBe(1);

      vi.advanceTimersByTime(419);
      expect(fixture.componentInstance.count()).toBe(1);

      vi.advanceTimersByTime(1);
      expect(fixture.componentInstance.count()).toBe(1);

      vi.advanceTimersByTime(85);
      expect(fixture.componentInstance.count()).toBe(2);

      vi.advanceTimersByTime(85);
      expect(fixture.componentInstance.count()).toBe(3);

      button.dispatchEvent(new PointerEvent('pointerup'));
      vi.advanceTimersByTime(200);
      expect(fixture.componentInstance.count()).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops on pointerleave', async () => {
    button.dispatchEvent(new PointerEvent('pointerdown'));
    expect(fixture.componentInstance.count()).toBe(1);

    await wait(500);
    button.dispatchEvent(new PointerEvent('pointerleave'));
    const countAtLeave = fixture.componentInstance.count();
    await wait(300);
    expect(fixture.componentInstance.count()).toBe(countAtLeave);
  });

  it('stops on pointercancel', async () => {
    button.dispatchEvent(new PointerEvent('pointerdown'));
    await wait(500);

    button.dispatchEvent(new PointerEvent('pointercancel'));
    const countAtCancel = fixture.componentInstance.count();
    await wait(300);
    expect(fixture.componentInstance.count()).toBe(countAtCancel);
  });

  it('cleans up timers on destroy so no further callbacks fire', async () => {
    button.dispatchEvent(new PointerEvent('pointerdown'));
    await wait(600);

    const countAtDestroy = fixture.componentInstance.count();
    expect(countAtDestroy).toBeGreaterThanOrEqual(2);

    fixture.destroy();

    await wait(300);
    // If the directive failed to clear timers, the interval would have
    // kept advancing the host signal after destroy.
    expect(fixture.componentInstance.count()).toBe(countAtDestroy);
  });
});
