import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Listbox } from './listbox';

interface Fruit {
  readonly id: string;
  readonly label: string;
  readonly alt?: string;
  readonly kind: 'stone' | 'berry' | 'citrus';
}

const FRUITS: readonly Fruit[] = [
  { id: 'peach', label: 'Peach', kind: 'stone' },
  { id: 'plum', label: 'Plum', kind: 'stone' },
  { id: 'rasp', label: 'Raspberry', alt: 'Rubus idaeus', kind: 'berry' },
  { id: 'lemon', label: 'Lemon', kind: 'citrus' },
];

@Component({
  selector: 'app-lb-host',
  template: `
    <app-listbox
      [options]="fruits"
      [value]="selected()!"
      ariaLabel="Pick a fruit"
      triggerLabel="{{ selected()?.label ?? '—' }}"
      triggerKicker="Fruit"
      [optionLabel]="labelFn"
      [optionAlt]="altFn"
      [optionGroup]="groupFn"
      [trackByFn]="trackFn"
      [open]="open()"
      (toggle)="open.set(!open())"
      (select)="onSelect($event)"
    />
  `,
  imports: [Listbox],
})
class LbHost {
  readonly fruits = FRUITS;
  readonly selected = signal<Fruit | null>(FRUITS[0]);
  readonly open = signal(false);
  readonly useGroups = signal(true);
  readonly labelFn = (f: Fruit) => f.label;
  readonly altFn = (f: Fruit) => f.alt ?? null;
  readonly groupFn = (f: Fruit) => (this.useGroups() ? f.kind : null);
  readonly trackFn = (f: Fruit) => f.id;
  onSelect(f: Fruit): void {
    this.selected.set(f);
    this.open.set(false);
  }
}

describe('Listbox', () => {
  let fixture: ComponentFixture<LbHost>;
  let host: LbHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LbHost] }).compileComponents();
    fixture = TestBed.createComponent(LbHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => fixture?.destroy());

  const trigger = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.btn') as HTMLButtonElement;

  it('renders the trigger with kicker and selected value', () => {
    expect(trigger().textContent).toContain('Fruit');
    expect(trigger().textContent).toContain('Peach');
  });

  it('exposes listbox semantics on the trigger', () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not render the menu when closed', () => {
    expect(fixture.nativeElement.querySelector('.dropdown-menu')).toBeNull();
  });

  it('emits toggle on trigger click without opening itself (parent owns state)', () => {
    trigger().click();
    fixture.detectChanges();
    expect(host.open()).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('renders groups in first-seen order with headers', () => {
    host.open.set(true);
    fixture.detectChanges();
    const groups = [...fixture.nativeElement.querySelectorAll('.dropdown-group')].map(
      (e: HTMLElement) => e.textContent,
    );
    expect(groups).toEqual(['stone', 'berry', 'citrus']);
  });

  it('renders every option as a listbox option', () => {
    host.open.set(true);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(items.length).toBe(4);
  });

  it('marks the selected option with aria-selected and the selected class', () => {
    host.open.set(true);
    fixture.detectChanges();
    const selected = fixture.nativeElement.querySelector('[role="option"][aria-selected="true"]');
    expect(selected).toBeTruthy();
    expect(selected.classList.contains('selected')).toBe(true);
    expect(selected.textContent).toContain('Peach');
  });

  it('renders the alt text for options that provide one', () => {
    host.open.set(true);
    fixture.detectChanges();
    const raspberry = [...fixture.nativeElement.querySelectorAll('[role="option"]')].find(
      (o: HTMLElement) => o.textContent?.includes('Raspberry'),
    ) as HTMLElement;
    expect(raspberry.querySelector('.item-alt')?.textContent).toBe('Rubus idaeus');
  });

  it('emits select with the chosen option and closes', () => {
    host.open.set(true);
    fixture.detectChanges();
    const lemon = [...fixture.nativeElement.querySelectorAll('[role="option"]')].find(
      (o: HTMLElement) => o.textContent?.includes('Lemon'),
    ) as HTMLButtonElement;
    lemon.click();
    expect(host.selected()?.id).toBe('lemon');
    expect(host.open()).toBe(false);
  });

  it('applies aria-label to the listbox menu', () => {
    host.open.set(true);
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('.dropdown-menu') as HTMLElement;
    expect(menu.getAttribute('role')).toBe('listbox');
    expect(menu.getAttribute('aria-label')).toBe('Pick a fruit');
  });

  it('renders no group headers when optionGroup is omitted', () => {
    host.useGroups.set(false);
    host.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dropdown-group').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(4);
  });
});
