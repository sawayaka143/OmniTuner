import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SCALE_TUNING_PRESETS } from '../../data/scale-tuning.constants';
import { SavedTuning, TuningSelection } from '../../models/scale-preferences.model';
import { TuningSelector } from './tuning-selector';

const SAVED_TUNING: SavedTuning = {
  id: 'custom-open-e',
  name: 'Open E',
  notes: [40, 47, 52, 56, 59, 64],
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
    fixture.componentRef.setInput('presets', SCALE_TUNING_PRESETS);
    fixture.componentRef.setInput('savedTunings', []);
    fixture.componentRef.setInput('selectedName', 'Standard');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits the saved tuning ID for edit without selecting it', async () => {
    fixture.componentRef.setInput('savedTunings', [SAVED_TUNING]);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let selection: TuningSelection | null = null;
    let editedId: string | null = null;
    component.select.subscribe((value) => { selection = value; });
    component.edit.subscribe((value) => { editedId = value; });

    const editButton = fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement;
    editButton.click();

    expect(editButton.getAttribute('aria-label')).toBe('Edit Open E tuning');
    expect(editedId).toBe(SAVED_TUNING.id);
    expect(selection).toBeNull();
  });

  it('deletes a saved tuning without selecting it', async () => {
    fixture.componentRef.setInput('savedTunings', [SAVED_TUNING]);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let selection: TuningSelection | null = null;
    let deletedId: string | null = null;
    component.select.subscribe((value) => { selection = value; });
    component.delete.subscribe((value) => { deletedId = value; });

    const deleteButton = fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement;
    deleteButton.click();

    expect(deletedId).toBe(SAVED_TUNING.id);
    expect(selection).toBeNull();
  });

  it('offers creation as a separate custom tuning action', async () => {
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    let createCount = 0;
    let editedId: string | null = null;
    component.create.subscribe(() => { createCount += 1; });
    component.edit.subscribe((value) => { editedId = value; });

    const createButton = fixture.nativeElement.querySelector('.create-option') as HTMLButtonElement;
    createButton.click();

    expect(createButton.textContent).toContain('New custom tuning…');
    expect(createCount).toBe(1);
    expect(editedId).toBeNull();
  });
});
