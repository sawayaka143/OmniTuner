import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Instrument, Tuning } from '../../models/instrument.model';
import { InstrumentSelector } from './instrument-selector';

const INSTRUMENTS: readonly Instrument[] = [
  { id: 'guitar', label: 'Guitar', stringCount: 6, tunings: [] },
  { id: 'ukulele', label: 'Ukulele', stringCount: 4, tunings: [] },
];

const E_STANDARD: Tuning = {
  id: 'e-standard',
  label: 'E Standard',
  strings: [{ name: 'E2', freq: 82.41 }],
};

const DROP_D: Tuning = {
  id: 'drop-d',
  label: 'Drop D',
  kind: 'custom',
  strings: [{ name: 'D2', freq: 73.42 }],
};

@Component({
  selector: 'app-is-host',
  template: `
    <app-instrument-selector
      [instruments]="instruments()"
      [selectedInstrumentId]="instrumentId()"
      [selectedInstrumentIndex]="instrumentIndex()"
      [availableTunings]="tunings()"
      [selectedTuningId]="tuningId()"
      [currentTuning]="currentTuning()"
      [dropdownOpen]="open()"
      (selectInstrument)="events.push(['instrument', $event])"
      (selectTuning)="events.push(['tuning', $event])"
      (newCustomTuning)="events.push(['newTuning'])"
      (newInstrument)="events.push(['newInstrument'])"
      (editCustomTuning)="events.push(['edit', $event])"
      (deleteCustomTuning)="events.push(['delete', $event])"
      (manageInstruments)="events.push(['manage'])"
      (toggleDropdown)="events.push(['toggle'])"
    />
  `,
  imports: [InstrumentSelector],
})
class SelectorHost {
  readonly instruments = signal(INSTRUMENTS);
  readonly instrumentId = signal('guitar');
  readonly instrumentIndex = signal(0);
  readonly tunings = signal<readonly Tuning[]>([E_STANDARD, DROP_D]);
  readonly tuningId = signal('e-standard');
  readonly currentTuning = signal(E_STANDARD);
  readonly open = signal(false);
  readonly events: (readonly unknown[])[] = [];
}

describe('InstrumentSelector', () => {
  let fixture: ComponentFixture<SelectorHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SelectorHost] }).compileComponents();
    fixture = TestBed.createComponent(SelectorHost);
    fixture.detectChanges();
  });

  const el = (selector: string): HTMLElement =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;
  const all = (selector: string): HTMLElement[] => [
    ...fixture.nativeElement.querySelectorAll(selector),
  ];

  it('should be created', () => {
    expect(fixture.nativeElement.querySelector('app-instrument-selector')).toBeTruthy();
  });

  it('renders one radio per instrument with the active one checked', () => {
    const radios = all('[role="radio"]');
    expect(radios.length).toBe(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].textContent?.trim()).toBe('Guitar');
    expect(radios[1].textContent?.trim()).toBe('Ukulele');
    expect(el('.add-instrument-segment').getAttribute('aria-label')).toBe('New instrument');
  });

  it('emits selectInstrument when an instrument segment is clicked', () => {
    all('[role="radio"]')[1].click();
    expect(fixture.componentInstance.events).toContainEqual(['instrument', 'ukulele']);
  });

  it('emits newInstrument from the plus segment', () => {
    el('.add-instrument-segment').click();
    expect(fixture.componentInstance.events).toContainEqual(['newInstrument']);
  });

  it('shows the current tuning and emits toggleDropdown from the trigger', () => {
    const trigger = el('.tuning-trigger');
    expect(trigger.textContent).toContain('E Standard');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    expect(fixture.componentInstance.events).toContainEqual(['toggle']);
  });

  it('lists preset and custom tunings when the dropdown opens', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const options = all('.tuning-option');
    expect(options.map((option) => option.textContent?.trim())).toEqual(['E Standard', 'Drop D']);
    expect(el('.tuning-trigger').getAttribute('aria-expanded')).toBe('true');
  });

  it('emits selectTuning when an option is chosen', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    all('.tuning-option')[0].click();
    expect(fixture.componentInstance.events).toContainEqual(['tuning', 'e-standard']);
  });

  it('emits edit and delete for custom tunings only', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const edit = fixture.nativeElement.querySelector(
      'button[aria-label="Edit Drop D"]',
    ) as HTMLButtonElement;
    const remove = fixture.nativeElement.querySelector(
      'button[aria-label="Delete Drop D"]',
    ) as HTMLButtonElement;
    edit.click();
    remove.click();

    expect(fixture.componentInstance.events).toContainEqual(['edit', 'drop-d']);
    expect(fixture.componentInstance.events).toContainEqual(['delete', 'drop-d']);
  });

  it('shows an empty message when no custom tunings exist', () => {
    fixture.componentInstance.tunings.set([E_STANDARD]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(el('.empty-message')?.textContent?.trim()).toBe('No custom tunings saved.');
    expect(fixture.nativeElement.querySelectorAll('.custom-row').length).toBe(0);
  });

  it('emits newCustomTuning and manageInstruments from the menu actions', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    el('.new-tuning-button').click();
    el('.manage-instruments-button').click();

    expect(fixture.componentInstance.events).toContainEqual(['newTuning']);
    expect(fixture.componentInstance.events).toContainEqual(['manage']);
  });
});
