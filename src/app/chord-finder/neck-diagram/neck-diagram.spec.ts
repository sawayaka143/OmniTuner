import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NeckDiagram } from './neck-diagram';

describe('NeckDiagram', () => {
  let fixture: ComponentFixture<NeckDiagram>;

  const baseInputs = {
    frets: [null, 3, 2, 0, 1, 0] as readonly (number | null)[],
    tuningMidi: [40, 45, 50, 55, 59, 64],
    tuningLabels: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    symbol: 'C',
    rootPc: 0,
    index: 0,
    view: 'dots' as const,
    labelMode: 'notes' as const,
    flats: false,
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NeckDiagram],
    }).compileComponents();

    fixture = TestBed.createComponent(NeckDiagram);
    fixture.componentRef.setInput('frets', baseInputs.frets);
    fixture.componentRef.setInput('tuningMidi', baseInputs.tuningMidi);
    fixture.componentRef.setInput('tuningLabels', baseInputs.tuningLabels);
    fixture.componentRef.setInput('symbol', baseInputs.symbol);
    fixture.componentRef.setInput('rootPc', baseInputs.rootPc);
    fixture.componentRef.setInput('index', baseInputs.index);
    fixture.componentRef.setInput('view', baseInputs.view);
    fixture.componentRef.setInput('labelMode', baseInputs.labelMode);
    fixture.componentRef.setInput('flats', baseInputs.flats);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(el().querySelector('svg.neck')).toBeTruthy();
  });

  it('sets a viewBox so the diagram scales responsively', () => {
    expect(el().querySelector('svg.neck')?.getAttribute('viewBox')).toBe('0 0 228 186');
  });

  it('labels the diagram for assistive tech', () => {
    expect(el().querySelector('svg.neck')?.getAttribute('aria-label')).toBe('C fingering 1');
  });

  it('marks muted strings with an x', () => {
    expect(el().querySelectorAll('.mute-mark').length).toBe(1);
  });

  it('renders one dot per sounding note in dots view', () => {
    expect(el().querySelectorAll('.note-dot').length).toBe(5);
    expect(el().querySelectorAll('.note-ring').length).toBe(0);
  });

  it('renders fret-number rings in lines view', () => {
    fixture.componentRef.setInput('view', 'lines');
    fixture.detectChanges();
    expect(el().querySelectorAll('.note-ring').length).toBe(5);
    expect(el().querySelectorAll('.note-dot').length).toBe(0);
    const ringTexts = [...el().querySelectorAll('.ring-text')].map((t) => t.textContent?.trim());
    expect(ringTexts).toContain('3');
    expect(ringTexts).toContain('0');
  });

  it('renders an edge label per sounding string', () => {
    expect(el().querySelectorAll('.edge-label').length).toBe(5);
  });

  it('shows degree labels when label mode is func', () => {
    fixture.componentRef.setInput('labelMode', 'func');
    fixture.detectChanges();
    const dotTexts = [...el().querySelectorAll('.dot-text')].map((t) => t.textContent?.trim());
    expect(dotTexts).toContain('R');
  });

  it('highlights the chord root dot', () => {
    expect(el().querySelectorAll('.note-dot.root').length).toBeGreaterThan(0);
  });
});
