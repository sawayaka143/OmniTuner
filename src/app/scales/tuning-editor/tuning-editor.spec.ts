import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SixStringMidiNotes } from '../../models/scale-preferences.model';
import { TuningEditor } from './tuning-editor';

const STANDARD_NOTES: SixStringMidiNotes = [40, 45, 50, 55, 59, 64];

describe('TuningEditor', () => {
  let component: TuningEditor;
  let fixture: ComponentFixture<TuningEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TuningEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(TuningEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('initialNotes', STANDARD_NOTES);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses accurate create and edit copy', async () => {
    const title = (): string =>
      (fixture.nativeElement.querySelector('#tuning-editor-title') as HTMLElement).textContent?.trim() ?? '';
    const subtitle = (): string =>
      (fixture.nativeElement.querySelector('#tuning-editor-subtitle') as HTMLElement).textContent?.trim() ?? '';
    const saveLabel = (): string =>
      (fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement).textContent?.trim() ?? '';

    expect(title()).toBe('New custom tuning');
    expect(subtitle()).toBe('Set each string by semitone');
    expect(saveLabel()).toBe('Save tuning');

    fixture.componentRef.setInput('mode', 'edit');
    await fixture.whenStable();

    expect(title()).toBe('Edit custom tuning');
    expect(subtitle()).toBe('Update the name or string pitches');
    expect(saveLabel()).toBe('Update tuning');
  });

  it('emits a user-edited name when saving', () => {
    let saved: { name: string; notes: SixStringMidiNotes } | null = null;
    component.save.subscribe((value) => { saved = value; });
    const input = fixture.nativeElement.querySelector('.name-field input') as HTMLInputElement;
    input.value = 'Open E shimmer';
    input.dispatchEvent(new Event('input'));

    (fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement).click();

    expect(saved).toEqual({ name: 'Open E shimmer', notes: STANDARD_NOTES });
  });
});
