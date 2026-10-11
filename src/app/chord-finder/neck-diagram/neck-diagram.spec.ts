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

  it('renders a fret-number ring per sounding note', () => {
    expect(el().querySelectorAll('.note-ring').length).toBe(5);
    const ringTexts = [...el().querySelectorAll('.ring-text')].map((t) => t.textContent?.trim());
    expect(ringTexts).toContain('3');
    expect(ringTexts).toContain('0');
  });

  it('renders an edge label per sounding string', () => {
    expect(el().querySelectorAll('.edge-label').length).toBe(5);
  });

  it('shows note names on the edge, or chord functions in func mode', () => {
    const edges = (): (string | undefined)[] =>
      [...el().querySelectorAll('.edge-label')].map((t) => t.textContent?.trim());
    expect(edges()).toContain('C3');
    fixture.componentRef.setInput('labelMode', 'func');
    fixture.detectChanges();
    expect(edges()).toContain('R');
  });
});
