import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TuningSelector, TuningOption } from './tuning-selector';

const PRESETS: readonly TuningOption[] = [
  { id: 'standard', name: 'Standard', notes: [40, 45, 50, 55, 59, 64], kind: 'preset' },
  { id: 'drop-d', name: 'Drop D', notes: [38, 45, 50, 55, 59, 64], kind: 'preset' },
];

const SAVED_TUNING: TuningOption = {
  id: 'custom-open-e',
  name: 'Open E',
  notes: [40, 47, 52, 56, 59, 64],
  kind: 'custom',
};

describe('TuningSelector', () => {
  let component: TuningSelector;
  let fixture: ComponentFixture<TuningSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TuningSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(TuningSelector);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('presets', PRESETS);
    fixture.componentRef.setInput('savedTunings', []);
    fixture.componentRef.setInput('selectedId', 'standard');
    fixture.componentRef.setInput('selectedName', 'Standard');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits the tuning ID on select', async () => {
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let selectedId: string | null = null;
    component.select.subscribe((value) => {
      selectedId = value;
    });

    const options = fixture.nativeElement.querySelectorAll('.selector-option');

    (options[1] as HTMLButtonElement).click();

    expect(selectedId).toBe('drop-d');
  });

  it('emits the saved tuning ID for edit without selecting it', async () => {
    fixture.componentRef.setInput('savedTunings', [SAVED_TUNING]);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let selection: string | null = null;
    let editedId: string | null = null;
    component.select.subscribe((value) => {
      selection = value;
    });
    component.edit.subscribe((value) => {
      editedId = value;
    });

    const editButton = fixture.nativeElement.querySelector(
      '[aria-label="Edit Open E tuning"]',
    ) as HTMLButtonElement;
    editButton.click();

    expect(editButton.getAttribute('aria-label')).toBe('Edit Open E tuning');
    expect(editedId).toBe(SAVED_TUNING.id);
    expect(selection).toBeNull();
  });

  it('deletes a saved tuning without selecting it', async () => {
    fixture.componentRef.setInput('savedTunings', [SAVED_TUNING]);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let selection: string | null = null;
    let deletedId: string | null = null;
    component.select.subscribe((value) => {
      selection = value;
    });
    component.delete.subscribe((value) => {
      deletedId = value;
    });

    const deleteButton = fixture.nativeElement.querySelector(
      '[aria-label="Delete Open E tuning"]',
    ) as HTMLButtonElement;
    deleteButton.click();

    expect(deletedId).toBe(SAVED_TUNING.id);
    expect(selection).toBeNull();
  });

  it('offers creation as a separate custom tuning action', async () => {
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let createCount = 0;
    let editedId: string | null = null;
    component.create.subscribe(() => {
      createCount += 1;
    });
    component.edit.subscribe((value) => {
      editedId = value;
    });

    const createButton = fixture.nativeElement.querySelector('.create-option') as HTMLButtonElement;
    createButton.click();

    expect(createButton.textContent).toContain('New custom tuning…');
    expect(createCount).toBe(1);
    expect(editedId).toBeNull();
  });
});
