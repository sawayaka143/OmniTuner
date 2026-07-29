import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScaleOptions } from './scale-options';

describe('ScaleOptions', () => {
  let component: ScaleOptions;
  let fixture: ComponentFixture<ScaleOptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScaleOptions],
    }).compileComponents();

    fixture = TestBed.createComponent(ScaleOptions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
