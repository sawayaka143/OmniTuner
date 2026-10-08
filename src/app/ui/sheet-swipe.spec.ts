import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { SheetSwipe } from './sheet-swipe';

@Component({
  selector: 'app-sheet-swipe-host',
  template: `
    <div class="sheet" appSheetSwipe (swipeDismiss)="dismissed.set(dismissed() + 1)">
      <div class="scroller"><button type="button">Item</button></div>
    </div>
  `,
  imports: [SheetSwipe],
})
class SheetHost {
  readonly dismissed = signal(0);
}

function mouseEvent(type: string, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { clientY, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

function touchEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === 'touchend' ? [] : [{ clientY }];
  Object.defineProperty(event, 'touches', { value: touches });
  return event;
}

describe('SheetSwipe', () => {
  let fixture: ComponentFixture<SheetHost>;
  let sheet: HTMLElement;
  let matches: boolean;

  beforeEach(async () => {
    matches = true;
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    await TestBed.configureTestingModule({ imports: [SheetHost] }).compileComponents();
    fixture = TestBed.createComponent(SheetHost);
    fixture.detectChanges();
    sheet = fixture.nativeElement.querySelector('.sheet') as HTMLElement;
    Object.defineProperty(sheet, 'offsetHeight', { value: 400, configurable: true });
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  const drag = (from: number, to: number): void => {
    sheet.dispatchEvent(mouseEvent('pointerdown', from));
    sheet.dispatchEvent(mouseEvent('pointermove', to));
    sheet.dispatchEvent(mouseEvent('pointerup', to));
  };

  it('follows a downward drag with the sheet', () => {
    sheet.dispatchEvent(mouseEvent('pointerdown', 0));
    sheet.dispatchEvent(mouseEvent('pointermove', 60));
    expect(sheet.style.transform).toBe('translateY(60px)');
  });

  it('emits swipeDismiss when dragged past the threshold', () => {
    drag(0, 200);
    expect(fixture.componentInstance.dismissed()).toBe(1);
  });

  it('springs back and does not dismiss on a short drag', () => {
    sheet.dispatchEvent(mouseEvent('pointerdown', 0));
    sheet.dispatchEvent(mouseEvent('pointermove', 30));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    sheet.dispatchEvent(mouseEvent('pointerup', 30));
    expect(fixture.componentInstance.dismissed()).toBe(0);
    expect(sheet.style.transform).toBe('');
  });

  it('dismisses on a quick flick even when short', () => {
    drag(0, 40);
    expect(fixture.componentInstance.dismissed()).toBe(1);
  });

  it('ignores upward drags', () => {
    sheet.dispatchEvent(mouseEvent('pointerdown', 200));
    sheet.dispatchEvent(mouseEvent('pointermove', 100));
    sheet.dispatchEvent(mouseEvent('pointerup', 100));
    expect(sheet.style.transform).toBe('');
    expect(fixture.componentInstance.dismissed()).toBe(0);
  });

  it('does nothing outside the phone layout', () => {
    matches = false;
    drag(0, 300);
    expect(sheet.style.transform).toBe('');
    expect(fixture.componentInstance.dismissed()).toBe(0);
  });

  it('does not start a drag from inside scrolled content', () => {
    const scroller = sheet.querySelector('.scroller') as HTMLElement;
    scroller.scrollTop = 20;
    const button = scroller.querySelector('button') as HTMLElement;
    button.dispatchEvent(mouseEvent('pointerdown', 0));
    sheet.dispatchEvent(mouseEvent('pointermove', 200));
    sheet.dispatchEvent(mouseEvent('pointerup', 200));
    expect(fixture.componentInstance.dismissed()).toBe(0);
  });

  it('supports touch drags and cancels scrolling while dragging', () => {
    sheet.dispatchEvent(touchEvent('touchstart', 0));
    const move = touchEvent('touchmove', 220);
    sheet.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    sheet.dispatchEvent(touchEvent('touchend', 220));
    expect(fixture.componentInstance.dismissed()).toBe(1);
  });

  it('swallows the click that follows a drag', () => {
    drag(0, 200);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('button')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
