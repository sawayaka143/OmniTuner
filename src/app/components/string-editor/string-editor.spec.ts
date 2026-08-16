import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresetOption, StringEditor, StringEditorValue } from './string-editor';

const INITIAL_NOTES: readonly number[] = [40, 45, 50, 55, 59, 64];
const PRESET: PresetOption = { id: 'drop-d', name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] };

describe('StringEditor', () => {
  let fixture: ComponentFixture<StringEditor>;
  let component: StringEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StringEditor] }).compileComponents();
    fixture = TestBed.createComponent(StringEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('initialName', '');
    fixture.componentRef.setInput('initialNotes', INITIAL_NOTES);
    fixture.componentRef.setInput('allowCountChange', true);
    await fixture.whenStable();
  });

  afterEach(() => fixture?.destroy());

  const form = (): HTMLFormElement =>
    fixture.nativeElement.querySelector('.editor-form') as HTMLFormElement;
  const nameInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const stepButtons = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('button.step-button')] as HTMLButtonElement[];
  // First two step-buttons belong to the count stepper (rendered when allowCountChange=true).
  // After that come pairs per string row (down, up), ordered top (= highest pitch) to bottom.
  const countDownButton = (): HTMLButtonElement => stepButtons()[0];
  const countUpButton = (): HTMLButtonElement => stepButtons()[1];
  // Bottom display row = lowest pitch = noteIndex 0 = INITIAL_NOTES[0] (E2, midi 40).
  // Each string row contributes 2 step-buttons, so the bottom row's down button sits at
  // index 2 + 2 * (rowCount - 1) = 2 + 2*5 = 12.
  const lowestStringDownButton = (): HTMLButtonElement => stepButtons()[12];
  const saveButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement;
  const cancelButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement;
  const errorText = (): string | null =>
    fixture.nativeElement.querySelector('.field-error')?.textContent ?? null;
  const noteNameOutputs = (): HTMLElement[] =>
    [...fixture.nativeElement.querySelectorAll('.note-name')] as HTMLElement[];
  const countValue = (): HTMLElement =>
    fixture.nativeElement.querySelector('.count-value') as HTMLElement;
  const stringRows = (): HTMLElement[] =>
    [...fixture.nativeElement.querySelectorAll('.string-row')] as HTMLElement[];

  it('initialises notes from the input and renders one row per string high-pitch-first', () => {
    expect(noteNameOutputs().length).toBe(INITIAL_NOTES.length);
    expect(noteNameOutputs()[0].textContent?.trim()).toBe('E4'); // top = highest = midi 64
    expect(noteNameOutputs()[5].textContent?.trim()).toBe('E2'); // bottom = lowest = midi 40
  });

  it('uses the createLabel in create mode', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('createLabel', 'Create instrument');
    fixture.detectChanges();
    expect(saveButton().textContent?.trim()).toBe('Create instrument');
  });

  it('uses the editLabel in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('editLabel', 'Save changes');
    fixture.detectChanges();
    expect(saveButton().textContent?.trim()).toBe('Save changes');
  });

  it('re-inits the row count when initialNotes change', () => {
    fixture.componentRef.setInput('initialNotes', [50, 55, 60]);
    fixture.detectChanges();
    expect(noteNameOutputs().length).toBe(3);
  });

  it('emits save with the trimmed name and current notes', () => {
    const saved: StringEditorValue[] = [];
    component.save.subscribe((v) => saved.push(v));
    nameInput().value = 'My custom';
    nameInput().dispatchEvent(new Event('input'));
    form().dispatchEvent(new Event('submit'));
    expect(saved).toEqual([{ name: 'My custom', notes: [...INITIAL_NOTES] }]);
  });

  it('blocks save and shows an error when the name is empty', () => {
    const saved: StringEditorValue[] = [];
    component.save.subscribe((v) => saved.push(v));
    form().dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(errorText()).toBe('Enter a name.');
  });

  it('disables the save button while an error is shown', () => {
    form().dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(saveButton().disabled).toBe(true);
  });

  it('clears the nameError when the user types', () => {
    form().dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(errorText()).toBe('Enter a name.');
    nameInput().value = 'abc';
    nameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(errorText()).toBeNull();
  });

  it('blocks save with a duplicate-name error against [disallowedNames]', () => {
    fixture.componentRef.setInput('disallowedNames', ['Existing']);
    fixture.detectChanges();
    const saved: StringEditorValue[] = [];
    component.save.subscribe((v) => saved.push(v));
    nameInput().value = 'existing';
    nameInput().dispatchEvent(new Event('input'));
    form().dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(errorText()).toBe('A name like this already exists.');
  });

  it('allows save when the name is not in [disallowedNames]', () => {
    fixture.componentRef.setInput('disallowedNames', ['Other']);
    fixture.detectChanges();
    const saved: StringEditorValue[] = [];
    component.save.subscribe((v) => saved.push(v));
    nameInput().value = 'my instr';
    nameInput().dispatchEvent(new Event('input'));
    form().dispatchEvent(new Event('submit'));
    expect(saved.length).toBe(1);
  });

  it('surfaces [externalError] in the field-error slot and blocks save', () => {
    fixture.componentRef.setInput('externalError', 'Registry rejected: bad data');
    fixture.detectChanges();
    expect(errorText()).toBe('Registry rejected: bad data');
    expect(saveButton().disabled).toBe(true);
  });

  it('emits preview on every step', () => {
    const previews: number[][] = [];
    component.preview.subscribe((n) => previews.push([...n]));
    lowestStringDownButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(previews.length).toBe(1);
    expect(previews[0][0]).toBe(39);
  });

  it('updates the rendered note name on step (DOM reflects state)', () => {
    lowestStringDownButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    fixture.detectChanges();
    expect(noteNameOutputs()[5].textContent?.trim()).toBe('D♯2');
  });

  it('clamps to the lower bound and emits nothing when at the limit', () => {
    fixture.componentRef.setInput('minNote', 40);
    fixture.detectChanges();
    const previews: number[][] = [];
    component.preview.subscribe((n) => previews.push([...n]));
    lowestStringDownButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(previews).toEqual([]);
    expect(noteNameOutputs()[5].textContent?.trim()).toBe('E2');
  });

  it('reacts to wheel events on a string row', () => {
    const wheel = new WheelEvent('wheel', { deltaY: 100 });
    stringRows()[5].dispatchEvent(wheel);
    fixture.detectChanges();
    expect(noteNameOutputs()[5].textContent?.trim()).toBe('D♯2');
  });

  it('highlights changed notes against [referenceNotes]', () => {
    fixture.componentRef.setInput('referenceNotes', INITIAL_NOTES);
    fixture.detectChanges();
    lowestStringDownButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    fixture.detectChanges();
    const changed = [
      ...fixture.nativeElement.querySelectorAll('.note-name.changed'),
    ] as HTMLElement[];
    expect(changed.length).toBe(1);
  });

  it('clears the name and applies a preset on click (also emits preview)', () => {
    const previews: number[][] = [];
    component.preview.subscribe((n) => previews.push([...n]));
    fixture.componentRef.setInput('presets', [PRESET]);
    fixture.detectChanges();
    nameInput().value = 'temp';
    nameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const presetButton = fixture.nativeElement.querySelector(
      '.preset-row app-pill-button button',
    ) as HTMLButtonElement;
    presetButton.click();
    fixture.detectChanges();

    expect(nameInput().value).toBe('');
    // PRESET.notes = [38, 45, 50, 55, 59, 64]; display reverse = high→low.
    // Top → midi 64 (E4), 59 (B3), 55 (G3), 50 (D3), 45 (A2), 38 (D2).
    expect(noteNameOutputs().map((el) => el.textContent?.trim())).toEqual([
      'E4',
      'B3',
      'G3',
      'D3',
      'A2',
      'D2',
    ]);
    expect(previews.length).toBe(1);
  });

  it('renders the count stepper only when allowCountChange is true', () => {
    expect(fixture.nativeElement.querySelector('.string-count-row')).toBeTruthy();
    fixture.componentRef.setInput('allowCountChange', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.string-count-row')).toBeNull();
  });

  it('decrements the count via the stepper, preserving existing notes', () => {
    countDownButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    fixture.detectChanges();
    expect(countValue().textContent?.trim()).toBe('5');
    expect(noteNameOutputs().length).toBe(5);
  });

  it('increments the count via the stepper, padding with a default fourth at the top', () => {
    countUpButton().dispatchEvent(new MouseEvent('click', { detail: 0 }));
    fixture.detectChanges();
    expect(countValue().textContent?.trim()).toBe('7');
    expect(noteNameOutputs().length).toBe(7);
    // New note is appended at notes[6] (= 40 + 6*5 = 70), which becomes the
    // topmost display row (noteIndex 6 maps to display row 0).
    expect(noteNameOutputs()[0].textContent?.trim()).toBe('A♯4');
  });

  it('emits cancel when the cancel button is clicked', () => {
    let cancelled = 0;
    component.cancel.subscribe(() => (cancelled += 1));
    cancelButton().click();
    expect(cancelled).toBe(1);
  });

  it('honours the accidental preference for note display', () => {
    fixture.componentRef.setInput('accidental', 'flat');
    fixture.componentRef.setInput('initialNotes', [42]); // F♯ / G♭ family
    fixture.detectChanges();
    expect(noteNameOutputs()[0].textContent?.trim()).toBe('G♭2');
  });

  it('hides the presets row when presets is empty', () => {
    expect(fixture.nativeElement.querySelector('.preset-row')).toBeNull();
  });
});
