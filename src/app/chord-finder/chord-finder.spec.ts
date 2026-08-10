import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChordFinder } from './chord-finder';
import { WHY_HINTS } from '../utils/ergonomics';
import { parseChord, parseTuning, ParsedChord, ParsedTuning } from '../utils/chord-theory';
import { SoundingNote, VoicingShape } from '../utils/chord-voicing';

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

  it('generates a progression with an invalid chord token in the middle without misaligning', () => {
    // Regression (Bug 2): `generate()` previously filtered the parsed chords
    // but passed the *unfiltered* shapes array to `scoreProgressionVoicings`,
    // so a parse error mid-progression shifted the pathfinding indices and
    // could misplace transition badges or crash. Both arrays are now filtered
    // together to stay aligned.
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'Cm, NOTACHORD, G';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click('.generate');
    expect(statusText()).toContain('done');
    // 3 cards: two valid chords + one invalid token card.
    expect(el().querySelectorAll('.chord-card').length).toBe(3);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(1);

    // Pathfinding must stay aligned: the invalid token breaks the adjacency,
    // so neither valid chord may carry a transition pointer. (The buggy code
    // filtered the parsed chords but passed the unfiltered shapes array,
    // which made the path land on the invalid token's empty shapes and leaked
    // a `-1` backpointer into bestNextIndex.)
    const results = (component as unknown as { results(): { bestNextIndex: (number | null)[] } }).results();
    expect(results.bestNextIndex[0]).toBeNull();
    expect(results.bestNextIndex[2]).toBeNull();
  });

  it('renders a single thumb hint when a shape has both string-skip and thumb-fretting', () => {
    // Regression (Bug 3): `ergonomicsHint()` pushed WHY_HINTS['thumb'] twice
    // when both `hasStringSkip` and `hasThumbFret` were true, producing a
    // duplicated "thumb fretting / skipped string · thumb fretting / skipped
    // string" label.
    const tuning = parseTuning('E2 A2 D3 G3 B3 E4');
    if (!tuning.ok) throw new Error('failed to parse tuning');
    const chord = parseChord('C');
    if (!chord.ok) throw new Error('failed to parse chord C');

    const frets: (number | null)[] = [1, 4, 4, null, 1, 1];
    const sounding: SoundingNote[] = frets
      .map((fret, stringIndex) => ({
        stringIndex,
        fret,
        midi: tuning.tuning.midi[stringIndex] + (fret ?? 0),
      }))
      .filter((n): n is SoundingNote => n.fret !== null);
    const frettedOnly = frets.filter((f): f is number => f !== null && f > 0);
    const shape: VoicingShape = {
      frets,
      sounding,
      span: Math.max(...frettedOnly) - Math.min(...frettedOnly),
      bassMidi: Math.min(...sounding.map((n) => n.midi)),
      bassIsRoot: false,
      position: Math.min(...frettedOnly),
      openCount: 0,
      cost: 0,
    };

    const hint = (
      component as unknown as {
        ergonomicsHint(shape: VoicingShape, chord: ParsedChord, tuning: ParsedTuning): string;
      }
    ).ergonomicsHint(shape, chord.chord, tuning.tuning);

    const occurrences = hint.split(WHY_HINTS['thumb']).length - 1;
    expect(occurrences).toBe(1);
  });
});
