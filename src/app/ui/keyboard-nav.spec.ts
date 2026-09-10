import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RovingRadioGroup } from './keyboard-nav';

@Component({
  selector: 'app-roving-host',
  imports: [RovingRadioGroup],
  template: `
    <div role="radiogroup" [appRovingRadioGroup]="enabled()">
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="value() === 'a'"
        (click)="value.set('a')"
      >
        A
      </button>
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="value() === 'b'"
        (click)="value.set('b')"
      >
        B
      </button>
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="value() === 'c'"
        (click)="value.set('c')"
      >
        C
      </button>
    </div>
  `,
})
class RovingHost {
  readonly value = signal('a');
  readonly enabled = signal(true);
}

describe('RovingRadioGroup', () => {
  let fixture: ComponentFixture<RovingHost>;

  const radios = (): HTMLButtonElement[] => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button[role="radio"]',
    ),
  ];

  const tabindexes = (): number[] => radios().map((r) => r.tabIndex);

  const group = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('[role="radiogroup"]') as HTMLElement;

  const keydown = (key: string, target: HTMLElement): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RovingHost] }).compileComponents();
    fixture = TestBed.createComponent(RovingHost);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('puts the checked radio in the tab order on init', () => {
    expect(tabindexes()).toEqual([0, -1, -1]);
  });

  it('moves the tab stop to the focused radio', () => {
    radios()[2].focus();
    group().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(tabindexes()).toEqual([-1, -1, 0]);
  });

  it('ignores focus events for elements that are not radios', () => {
    group().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(tabindexes()).toEqual([0, -1, -1]);
  });

  it('moves selection with the arrow keys', () => {
    keydown('ArrowRight', radios()[0]);
    expect(fixture.componentInstance.value()).toBe('b');

    keydown('ArrowDown', radios()[1]);
    expect(fixture.componentInstance.value()).toBe('c');
  });

  it('wraps around at both ends', () => {
    keydown('ArrowLeft', radios()[0]);
    expect(fixture.componentInstance.value()).toBe('c');

    keydown('ArrowRight', radios()[2]);
    expect(fixture.componentInstance.value()).toBe('a');
  });

  it('jumps to the first and last option with Home and End', () => {
    keydown('End', radios()[0]);
    expect(fixture.componentInstance.value()).toBe('c');

    keydown('Home', radios()[2]);
    expect(fixture.componentInstance.value()).toBe('a');
  });

  it('ignores unrelated keys', () => {
    const event = keydown('a', radios()[0]);

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.value()).toBe('a');
  });

  it('does nothing when the roving group is disabled', () => {
    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();
    const event = keydown('ArrowRight', group());

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.value()).toBe('a');
  });

  it('leaves the tab order alone on init when disabled from the start', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RovingHost] }).compileComponents();
    fixture = TestBed.createComponent(RovingHost);
    fixture.componentInstance.enabled.set(false);
    fixture.componentInstance.value.set('b');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tabindexes()).toEqual([0, 0, 0]);
  });
});
