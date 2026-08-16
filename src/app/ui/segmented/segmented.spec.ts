import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Segmented } from './segmented';

interface Mode {
  readonly value: string;
  readonly label: string;
}

const MODES: readonly Mode[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto', label: 'Auto' },
  { value: 'chromatic', label: 'Chromatic' },
];

@Component({
  selector: 'app-seg-host',
  template: `
    <app-segmented
      [options]="modes"
      [value]="selected()"
      ariaLabel="Tuner mode"
      [indicator]="indicatorValue()"
      [optionLabel]="labelFn"
      [trackByFn]="trackFn"
      [gridColumns]="gridValue()"
      (select)="onSelect($event)"
    />
  `,
  imports: [Segmented],
})
class SegHost {
  readonly modes = MODES;
  readonly selected = signal<Mode>(MODES[1]);
  readonly indicatorValue = signal<'plain' | 'accent'>('accent');
  readonly gridValue = signal<string | undefined>(undefined);
  readonly labelFn = (m: Mode) => m.label;
  readonly trackFn = (m: Mode) => m.value;
  onSelect(m: Mode): void {
    this.selected.set(m);
  }
}

describe('Segmented', () => {
  let fixture: ComponentFixture<SegHost>;
  let host: SegHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SegHost] }).compileComponents();
    fixture = TestBed.createComponent(SegHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => fixture?.destroy());

  const buttons = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];

  const indicator = (): HTMLElement =>
    fixture.nativeElement.querySelector('.segment-indicator') as HTMLElement;

  const container = (): HTMLElement =>
    fixture.nativeElement.querySelector('.segmented') as HTMLElement;

  it('wraps buttons in a radiogroup with the ariaLabel', () => {
    expect(container().getAttribute('role')).toBe('radiogroup');
    expect(container().getAttribute('aria-label')).toBe('Tuner mode');
  });

  it('renders one radio button per option', () => {
    expect(buttons().length).toBe(3);
    for (const btn of buttons()) {
      expect(btn.getAttribute('role')).toBe('radio');
    }
  });

  it('binds the option labels via optionLabel', () => {
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Manual', 'Auto', 'Chromatic']);
  });

  it('marks the selected option aria-checked and active', () => {
    expect(host.selected().value).toBe('auto');
    const selected = buttons().find((b) => b.getAttribute('aria-checked') === 'true');
    expect(selected?.textContent?.trim()).toBe('Auto');
    expect(selected?.classList.contains('active')).toBe(true);
  });

  it('emits select on click', () => {
    buttons()[2].click();
    expect(host.selected().value).toBe('chromatic');
  });

  it('sets --seg-count to options length', () => {
    expect(container().getAttribute('style')).toContain('--seg-count: 3');
  });

  it('translates the indicator to the selected index', () => {
    expect(indicator().getAttribute('style')).toContain('translateX(100%)');
  });

  it('moves the indicator when selection changes', () => {
    host.selected.set(MODES[2]);
    fixture.detectChanges();
    expect(indicator().getAttribute('style')).toContain('translateX(200%)');
  });

  it('hides the indicator when no option matches the value', () => {
    host.selected.set({ value: 'unknown', label: 'Unknown' });
    fixture.detectChanges();
    expect(indicator().classList.contains('hidden')).toBe(true);
  });

  it('applies the indicator-accent class for the accent variant', () => {
    expect(container().classList.contains('indicator-accent')).toBe(true);
  });

  it('omits the indicator-accent class for the plain variant', () => {
    host.indicatorValue.set('plain');
    fixture.detectChanges();
    expect(container().classList.contains('indicator-accent')).toBe(false);
  });

  it('switches to grid layout when gridColumns is provided', () => {
    host.gridValue.set('repeat(3, 48px)');
    fixture.detectChanges();
    expect(container().classList.contains('is-grid')).toBe(true);
    expect(container().getAttribute('style')).toContain('grid-template-columns: repeat(3, 48px)');
  });

  it('omits grid styling by default (inline-flex from the mixin)', () => {
    expect(container().classList.contains('is-grid')).toBe(false);
    expect(container().getAttribute('style')?.includes('grid-template-columns')).toBe(false);
  });
});
