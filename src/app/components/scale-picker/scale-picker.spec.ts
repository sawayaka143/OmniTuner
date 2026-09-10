import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Scale } from '../../models/scale.model';
import { ScalePicker } from './scale-picker';

const SCALES: Scale[] = [
  { id: 'major', label: 'Major', group: 'Common', intervals: [] },
  { id: 'minor', label: 'Minor', aka: 'Aeolian', group: 'Common', intervals: [] },
  { id: 'dorian', label: 'Dorian', group: 'Modes', intervals: [] },
];

describe('ScalePicker', () => {
  let fixture: ComponentFixture<ScalePicker>;
  let component: ScalePicker;
  let selected: string[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const options = (): HTMLButtonElement[] => [
    ...el().querySelectorAll<HTMLButtonElement>('[role="option"]'),
  ];
  const trigger = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>('button.btn') as HTMLButtonElement;

  const create = async (open: boolean, selectedId = 'major'): Promise<void> => {
    fixture.componentRef.setInput('scales', SCALES);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    selected = [];
    await TestBed.configureTestingModule({ imports: [ScalePicker] }).compileComponents();
    fixture = TestBed.createComponent(ScalePicker);
    component = fixture.componentInstance;
    component.select.subscribe((id) => selected.push(id));
  });

  afterEach(() => fixture?.destroy());

  it('shows the selected scale label on the trigger', async () => {
    await create(false);

    expect(trigger().textContent).toContain('Major');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('falls back to an empty label for an unknown selection', async () => {
    await create(false, 'missing');

    expect(trigger().textContent).not.toContain('Major');
  });

  it('renders options only when open', async () => {
    await create(false);
    expect(options().length).toBe(0);

    await create(true);
    expect(options().length).toBe(SCALES.length);
  });

  it('groups the scales by their group label', async () => {
    await create(true);

    const groups = [...el().querySelectorAll('.dropdown-group')].map((g) => g.textContent?.trim());
    expect(groups).toEqual(['Common', 'Modes']);
  });

  it('puts scales without a group under a default heading', () => {
    fixture.componentRef.setInput('scales', [{ id: 'x', label: 'Loose', intervals: [] }]);
    fixture.componentRef.setInput('selectedId', 'x');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(el().querySelector('.dropdown-group')?.textContent?.trim()).toBe('Scales');
  });

  it('emits the chosen scale id', async () => {
    await create(true);

    options()[2].click();
    fixture.detectChanges();

    expect(selected).toEqual(['dorian']);
  });

  it('marks the current scale as selected and shows its alias', async () => {
    await create(true, 'minor');

    const minor = options().find((option) => option.textContent?.includes('Minor'));
    expect(minor?.getAttribute('aria-selected')).toBe('true');
    expect(minor?.textContent).toContain('Aeolian');
  });

  it('emits toggle from the trigger', async () => {
    await create(false);
    const toggles: number[] = [];
    component.toggle.subscribe(() => toggles.push(1));

    trigger().click();

    expect(toggles.length).toBe(1);
  });

  it('opens on Enter, Space and ArrowDown when closed', async () => {
    await create(false);
    const toggles: number[] = [];
    component.toggle.subscribe(() => toggles.push(1));

    for (const key of ['Enter', ' ', 'ArrowDown']) {
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    expect(toggles.length).toBe(3);
  });

  it('closes on Escape while open and ignores other keys', async () => {
    await create(true);
    const closes: number[] = [];
    const toggles: number[] = [];
    component.close.subscribe(() => closes.push(1));
    component.toggle.subscribe(() => toggles.push(1));

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(closes.length).toBe(1);
    expect(toggles.length).toBe(0);
  });

  it('moves focus through the menu with arrows, Home and End', async () => {
    await create(true);
    const list = options();

    list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(list[1]);

    list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(list[list.length - 1]);

    list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(list[list.length - 1]);
  });

  it('closes and returns focus to the trigger on Escape from the menu', async () => {
    await create(true);
    const closes: number[] = [];
    component.close.subscribe(() => closes.push(1));

    options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(closes.length).toBe(1);
    expect(document.activeElement).toBe(trigger());
  });

  it('closes when tabbing out of the menu', async () => {
    await create(true);
    const closes: number[] = [];
    component.close.subscribe(() => closes.push(1));

    options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(closes.length).toBe(1);
  });
});
