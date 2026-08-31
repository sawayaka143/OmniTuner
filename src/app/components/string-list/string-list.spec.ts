import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TuningString } from '../../models/instrument.model';
import { StringList } from './string-list';

const STRINGS: readonly TuningString[] = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110 },
  { name: 'D3', freq: 146.83 },
];

@Component({
  selector: 'app-sl-host',
  template: `
    <app-string-list
      [strings]="strings()"
      [activeString]="active()"
      [inTune]="inTune()"
      [tunedStrings]="tuned()"
      (select)="selected.set($event)"
    />
  `,
  imports: [StringList],
})
class StringListHost {
  readonly strings = signal<readonly TuningString[]>(STRINGS);
  readonly active = signal<string | null>('A2');
  readonly inTune = signal(false);
  readonly tuned = signal<readonly string[]>([]);
  readonly selected = signal<number | null>(null);
}

describe('StringList', () => {
  let fixture: ComponentFixture<StringListHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StringListHost] }).compileComponents();
    fixture = TestBed.createComponent(StringListHost);
    fixture.detectChanges();
  });

  const buttons = (): HTMLButtonElement[] => [
    ...fixture.nativeElement.querySelectorAll('button.string-btn'),
  ];

  it('should be created', () => {
    expect(fixture.nativeElement.querySelector('app-string-list')).toBeTruthy();
  });

  it('renders one radio per string with an accessible name', () => {
    const btns = buttons();
    expect(btns.length).toBe(3);
    expect(btns[0].getAttribute('role')).toBe('radio');
    expect(btns[0].getAttribute('aria-label')).toBe('Target E2');
    expect(btns[1].textContent?.trim()).toBe('A2');
  });

  it('marks the active string and exposes selection through the select output', () => {
    expect(buttons()[1].classList.contains('active')).toBe(true);
    expect(buttons()[1].getAttribute('aria-checked')).toBe('true');

    buttons()[2].click();
    expect(fixture.componentInstance.selected()).toBe(2);
  });

  it('highlights tuned strings and the in-tune active string', () => {
    const host = fixture.componentInstance;
    host.tuned.set(['E2']);
    host.inTune.set(true);
    fixture.detectChanges();

    expect(buttons()[0].classList.contains('tuned')).toBe(true);
    expect(buttons()[1].classList.contains('in-tune')).toBe(true);
    expect(buttons()[2].classList.contains('tuned')).toBe(false);
  });

  it('keeps exactly one tabbable radio via the roving tabindex', () => {
    const tabbable = buttons().filter((btn) => btn.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0].textContent?.trim()).toBe('A2');
  });

  it('moves focus with arrow keys and wraps to the ends with Home/End', () => {
    const btns = buttons();
    btns[1].focus();
    btns[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(btns[2]);

    btns[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(btns[2]);

    btns[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(btns[0]);

    btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(btns[0]);

    btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(btns[2]);
  });
});
