import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RootNotePicker } from './root-note-picker';

const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

describe('RootNotePicker', () => {
  let fixture: ComponentFixture<RootNotePicker>;
  let component: RootNotePicker;
  let selected: string[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const options = (): HTMLButtonElement[] => [
    ...el().querySelectorAll<HTMLButtonElement>('[role="option"]'),
  ];
  const trigger = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>('button.btn') as HTMLButtonElement;

  const create = async (open: boolean): Promise<void> => {
    fixture.componentRef.setInput('notes', NOTES);
    fixture.componentRef.setInput('selected', 'C');
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    selected = [];
    await TestBed.configureTestingModule({ imports: [RootNotePicker] }).compileComponents();
    fixture = TestBed.createComponent(RootNotePicker);
    component = fixture.componentInstance;
    component.select.subscribe((note) => selected.push(note));
  });

  afterEach(() => fixture?.destroy());

  it('shows the selected note on the trigger', async () => {
    await create(false);

    expect(trigger().textContent).toContain('C');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the note options only when open', async () => {
    await create(false);
    expect(options().length).toBe(0);

    await create(true);
    expect(options().length).toBe(NOTES.length);
  });

  it('emits the chosen note and marks the current one as selected', async () => {
    await create(true);

    options()[2].click();
    fixture.detectChanges();

    expect(selected).toEqual(['D']);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('shows the enharmonic alternative for accidental notes', async () => {
    await create(true);

    const dFlat = [...options()].find((option) => option.textContent?.includes('C#'));
    expect(dFlat?.textContent).toContain('D♭');
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

  it('closes on Escape while open', async () => {
    await create(true);
    const closes: number[] = [];
    component.close.subscribe(() => closes.push(1));

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closes.length).toBe(1);
  });

  it('ignores other keys on the trigger', async () => {
    await create(false);
    const toggles: number[] = [];
    component.toggle.subscribe(() => toggles.push(1));

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(toggles.length).toBe(0);
  });

  it('moves focus through the menu with arrows, Home and End', async () => {
    await create(true);
    const list = options();

    list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(list[1]);

    list[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(list[0]);

    list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(list[list.length - 1]);

    list[list.length - 1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    expect(document.activeElement).toBe(list[0]);
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

    options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(closes.length).toBe(1);
  });
});
