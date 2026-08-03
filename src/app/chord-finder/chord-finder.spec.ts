import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChordFinder } from './chord-finder';

describe('ChordFinder', () => {
  let component: ChordFinder;
  let fixture: ComponentFixture<ChordFinder>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const click = (selector: string): void => {
    el().querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  };

  const statusText = (): string => el().querySelector('.readout p')?.textContent?.trim() ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChordFinder],
    }).compileComponents();

    fixture = TestBed.createComponent(ChordFinder);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the welcome state before generating', () => {
    expect(el().querySelector('.output-scroll')?.textContent).toContain('Chord finder ready.');
  });

  it('validates the default tuning live', () => {
    expect(el().querySelector('#cf-tuning + .hint')?.textContent).toContain('✓ 6 strings');
  });

  it('generates voicing blocks for the default progression', () => {
    click('.generate');
    expect(el().querySelectorAll('.chord-block').length).toBe(4);
    expect(statusText()).toContain('done');
  });

  it('reports a tuning parse error instead of generating', () => {
    const tuningInput = el().querySelector<HTMLInputElement>('#cf-tuning');
    if (!tuningInput) throw new Error('tuning input missing');
    tuningInput.value = 'E2 X2';
    tuningInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(statusText()).toContain('tuning:');
    expect(el().querySelectorAll('.chord-block').length).toBe(0);
  });

  it('requires a progression before generating', () => {
    const progressionInput = el().querySelector<HTMLInputElement>('#cf-progression');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = '';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(statusText()).toContain('type a chord progression');
  });

  it('switches between tab and diagram renderings', () => {
    click('.generate');
    expect(el().querySelectorAll('app-neck-diagram').length).toBeGreaterThan(0);

    el().querySelectorAll<HTMLButtonElement>('.segmented.view button')[0].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('app-neck-diagram').length).toBe(0);
    expect(el().querySelectorAll('.tab-line').length).toBeGreaterThan(0);
  });

  it('clears results back to the welcome state', () => {
    click('.generate');
    expect(el().querySelectorAll('.chord-block').length).toBeGreaterThan(0);

    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 1].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.chord-block').length).toBe(0);
    expect(el().querySelector('.output-scroll')?.textContent).toContain('Chord finder ready.');
    expect(statusText()).toContain('cleared');
  });

  it('refuses to copy before anything was generated', async () => {
    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(statusText()).toContain('nothing to copy');
  });
});
