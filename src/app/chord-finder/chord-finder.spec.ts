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

  it('starts with a random progression', () => {
    const input = fieldInput('chords, comma-separated');
    expect(input?.value.trim().length).toBeGreaterThan(0);
    const tokens = input!.value
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    expect(tokens.length).toBeLessThanOrEqual(6);
  });

  it('shuffle randomizes the progression', () => {
    const input = fieldInput('chords, comma-separated')!;
    const before = input.value;
    const shuffleBtn = [...el().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Shuffle',
    )!;
    expect(shuffleBtn).toBeTruthy();
    shuffleBtn.click();
    fixture.detectChanges();
    const tokens = input.value
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    expect(tokens.length).toBeLessThanOrEqual(6);
    expect(input.value).not.toEqual(before);
  });

  it('validates the default tuning live', () => {
    const input = fieldInput('custom');
    expect(input).toBeTruthy();
    const hint = input?.parentElement?.querySelector('.hint');
    expect(hint?.textContent).toContain('✓ 6 strings');
  });

  it('generates voicing blocks for the default progression', () => {
    click('.generate');
    const cards = el().querySelectorAll('.chord-card').length;
    expect(cards).toBeGreaterThanOrEqual(3);
    expect(cards).toBeLessThanOrEqual(6);
  });

  it('generates voicings for extended and altered chords', () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'C13, G7b13';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBe(2);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(0);
    // C13's optional 11th/13th show in parentheses (sharp spelling: A# for Bb).
    expect(el().textContent).toContain('tones C E G A# D (F) (A)');
  });

  it('reports a tuning parse error instead of generating', () => {
    const tuningInput = fieldInput('custom');
    if (!tuningInput) throw new Error('tuning input missing');
    tuningInput.value = 'E2 X2';
    tuningInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('requires a progression before generating', () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = '';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('switches between tab and diagram renderings', () => {
    click('.generate');
    expect(el().querySelectorAll('app-neck-diagram').length).toBeGreaterThan(0);

    el().querySelectorAll<HTMLButtonElement>('.rail-group button[role="radio"]')[0].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('app-neck-diagram').length).toBe(0);
    expect(el().querySelectorAll('.tab-line').length).toBeGreaterThan(0);
  });

  it('shows detected key after generating', () => {
    const input = fieldInput('chords, comma-separated')!;
    input.value = 'C, F, G';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('.generate');
    expect(el().textContent).toContain('Detected key:');
    expect(el().textContent).toContain('C');
  });

  it('clears results back to the welcome state', () => {
    click('.generate');
    expect(el().querySelectorAll('.chord-card').length).toBeGreaterThan(0);

    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 1].click(); // clear is last
    fixture.detectChanges();
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
    expect(el().querySelector('.stage-well')?.textContent).toContain('Chord finder ready.');
  });

  it('refuses to copy before anything was generated', async () => {
    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 2].click(); // copy tab is second-to-last
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('generates a progression with an invalid chord token in the middle without misaligning', () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'Cm, NOTACHORD, G';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    // 3 cards: two valid chords + one invalid token card.
    expect(el().querySelectorAll('.chord-card').length).toBe(3);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(1);
  });

});
