import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScaleTone } from '../../models/scale.model';
import { ScaleNotes } from './scale-notes';

const ROOT_TONE: ScaleTone = {
  pitchClass: 4,
  midi: 40,
  noteName: 'E',
  interval: { semitones: 0, label: '1' },
  color: '#779900',
  isRoot: true,
};

describe('ScaleNotes', () => {
  let component: ScaleNotes;
  let fixture: ComponentFixture<ScaleNotes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScaleNotes],
    }).compileComponents();

    fixture = TestBed.createComponent(ScaleNotes);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tones', [ROOT_TONE]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the scale degree', () => {
    const degree = fixture.nativeElement.querySelector('.tone span') as HTMLSpanElement;

    expect(degree.textContent?.trim()).toBe('1');
  });

  it('emits the selected tone', () => {
    const played: ScaleTone[] = [];
    component.play.subscribe((tone) => played.push(tone));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(played).toEqual([ROOT_TONE]);
  });
});
