import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwatchGroup } from './swatch-group';

interface Swatch {
  readonly value: string;
  readonly name: string;
}

const SWATCHES: readonly Swatch[] = [
  { value: '#779900', name: 'Olive' },
  { value: '#cc4422', name: 'Brick' },
  { value: '#22aacc', name: 'Sky' },
];

@Component({
  selector: 'app-sg-host',
  template: `
    <app-swatch-group
      [options]="swatches"
      [value]="selected()"
      ariaLabel="Accent color"
      [swatchColor]="colorFn"
      [ariaLabelFor]="nameFn"
      [trackByFn]="trackFn"
      [compareWith]="compareFn"
      (select)="onSelect($event)"
    />
  `,
  imports: [SwatchGroup],
})
class SgHost {
  readonly swatches = SWATCHES;
  readonly selected = signal<Swatch>(SWATCHES[0]);
  readonly colorFn = (s: Swatch) => s.value;
  readonly nameFn = (s: Swatch) => s.name;
  readonly trackFn = (s: Swatch) => s.value;
  readonly compareFn = (a: Swatch, b: Swatch) => a.value.toLowerCase() === b.value.toLowerCase();
  onSelect(s: Swatch): void {
    this.selected.set(s);
  }
}

describe('SwatchGroup', () => {
  let fixture: ComponentFixture<SgHost>;
  let host: SgHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SgHost] }).compileComponents();
    fixture = TestBed.createComponent(SgHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => fixture?.destroy());

  const buttons = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('.swatch')] as HTMLButtonElement[];

  it('renders one radio button per option', () => {
    expect(buttons().length).toBe(3);
    for (const btn of buttons()) {
      expect(btn.getAttribute('role')).toBe('radio');
    }
  });

  it('wraps buttons in a radiogroup with the ariaLabel', () => {
    const group = fixture.nativeElement.querySelector('.swatches') as HTMLElement;
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Accent color');
  });

  it('binds the swatch color to a CSS custom property', () => {
    expect(buttons()[0].getAttribute('style')).toContain('--swatch-color: #779900');
  });

  it('uses the name as both aria-label and title', () => {
    const first = buttons()[0];
    expect(first.getAttribute('aria-label')).toBe('Olive');
    expect(first.getAttribute('title')).toBe('Olive');
  });

  it('marks the matching option selected using compareWith (case-insensitive)', () => {
    host.selected.set({ value: '#CC4422', name: 'brick' });
    fixture.detectChanges();
    const selected = buttons().find((b) => b.getAttribute('aria-checked') === 'true');
    expect(selected?.getAttribute('title')).toBe('Brick');
  });

  it('applies the selected class to the matching option', () => {
    const selected = buttons().find((b) => b.classList.contains('selected'));
    expect(selected?.getAttribute('title')).toBe('Olive');
  });

  it('emits the selected option on click', () => {
    buttons()[2].click();
    expect(host.selected().value).toBe('#22aacc');
  });
});