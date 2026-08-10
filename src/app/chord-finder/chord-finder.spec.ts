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

  const fieldInput = (labelText: string): HTMLInputElement | null => {
    const label = [...el().querySelectorAll<HTMLLabelElement>('label')].find((candidate) =>
      candidate.textContent?.includes(labelText),
    );
    if (!label) return null;
    const id = label.getAttribute('for');
    return id ? el().querySelector<HTMLInputElement>(`#${id}`) : null;
  };

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
    expect(el().querySelector('.stage-well')?.textContent).toContain('Chord finder ready.');
  });

  it('validates the default tuning live', () => {
    const input = fieldInput('custom');
    expect(input).toBeTruthy();
    const hint = input?.parentElement?.querySelector('.hint');
    expect(hint?.textContent).toContain('✓ 6 strings');
  });

  it('generates voicing blocks for the default progression', () => {
    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBe(4);
    expect(statusText()).toContain('done');
  });

  it('reports a tuning parse error instead of generating', () => {
    const tuningInput = fieldInput('custom');
    if (!tuningInput) throw new Error('tuning input missing');
    tuningInput.value = 'E2 X2';
    tuningInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(statusText()).toContain('tuning:');
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('requires a progression before generating', () => {
    const progressionInput = fieldInput('chords, comma-separated');
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

    el().querySelectorAll<HTMLButtonElement>('.rail-group button[role="radio"]')[0].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('app-neck-diagram').length).toBe(0);
    expect(el().querySelectorAll('.tab-line').length).toBeGreaterThan(0);
  });

  it('clears results back to the welcome state', () => {
    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBeGreaterThan(0);

    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 1].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
    expect(el().querySelector('.stage-well')?.textContent).toContain('Chord finder ready.');
    expect(statusText()).toContain('cleared');
  });

  it('refuses to copy before anything was generated', async () => {
    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(statusText()).toContain('nothing to copy');
  });

  it('shows the smooth-transitions toggle and applies it', () => {
    const toggle = el().querySelector<HTMLButtonElement>('.toggle-row button[role="switch"]');
    expect(toggle).toBeTruthy();
    click('.generate');
    expect(el().querySelectorAll('.card-reason').length).toBeGreaterThan(0);
  });

  it('marks the easiest-transition fingering per chord', () => {
    click('.generate');
    const badges = el().querySelectorAll('.transition-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('pins a fingering and it stays pinned on regenerate', () => {
    click('.generate');
    const pinBtn = el().querySelector<HTMLButtonElement>(
      '.shape-action[aria-label="Pin this fingering"]',
    );
    pinBtn?.click();
    fixture.detectChanges();
    expect(statusText()).toContain('pinned');
    const pinned = el().querySelector<HTMLButtonElement>(
      '.shape-action.active[aria-label="Unpin this fingering"]',
    );
    expect(pinned).toBeTruthy();

    // Regenerate: the pinned shape stays in the list (bubbles to top).
    click('.generate');
    const stillPinned = el().querySelector<HTMLButtonElement>(
      '.shape-action.active[aria-label="Unpin this fingering"]',
    );
    expect(stillPinned).toBeTruthy();
  });

  it('unpins a fingering on second click', () => {
    click('.generate');
    const pinBtn = el().querySelector<HTMLButtonElement>(
      '.shape-action[aria-label="Pin this fingering"]',
    );
    pinBtn?.click();
    fixture.detectChanges();

    const unpinBtn = el().querySelector<HTMLButtonElement>(
      '.shape-action[aria-label="Unpin this fingering"]',
    );
    unpinBtn?.click();
    fixture.detectChanges();
    expect(statusText()).toContain('unpinned');
    const unmarked = el().querySelector<HTMLButtonElement>(
      '.shape-action.active[aria-label="Unpin this fingering"]',
    );
    expect(unmarked).toBeFalsy();
  });
});
