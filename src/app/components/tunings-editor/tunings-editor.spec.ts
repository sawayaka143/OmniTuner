import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TuningEditor } from './tunings-editor';

describe('TuningEditor', () => {
  let component: TuningEditor;
  let fixture: ComponentFixture<TuningEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TuningEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(TuningEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
