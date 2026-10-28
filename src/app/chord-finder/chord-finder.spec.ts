import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { PROGRESSION_PRESETS } from '../data/chord-progression-presets';
import { degreesToProgression } from '../utils/degree-to-chord';
import { flatsForPc } from '../utils/chord-theory';
import { SCALE_PREFERENCES_STORAGE } from '../services/scale-preferences';
import { VoicingSearchMessage, VoicingSearchRequest } from '../utils/voicing-batch';
import { ChordFinder } from './chord-finder';
import { VOICING_WORKER_FACTORY } from './voicing-search';

describe('ChordFinder', () => {
  let component: ChordFinder;
  let fixture: ComponentFixture<ChordFinder>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const click = (selector: string): void => {
    el().querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  };

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const generate = async (): Promise<void> => {
    click('.generate');
    await settle();
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
      providers: [{ provide: SCALE_PREFERENCES_STORAGE, useValue: null }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChordFinder);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows an empty stage before generating', () => {
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
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

  it('shuffle applies the forced random preset and tonic', async () => {
    const input = fieldInput('chords, comma-separated')!;
    const shuffleBtn = [...el().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Shuffle',
    )!;
    expect(shuffleBtn).toBeTruthy();

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0);
    shuffleBtn.click();
    fixture.detectChanges();
    randomSpy.mockRestore();
    await settle();

    const expected = degreesToProgression(PROGRESSION_PRESETS[0].degrees, 0, flatsForPc(0)).join(
      ', ',
    );
    expect(input.value).toBe(expected);
    const tokens = expected.split(/[,;|]/).filter(Boolean);
    expect(tokens.length).toBeGreaterThanOrEqual(3);
    expect(el().querySelectorAll('.chord-card').length).toBe(tokens.length);
  });

  it('validates the default tuning live', () => {
    const input = fieldInput('custom');
    expect(input).toBeTruthy();
    const hint = input?.parentElement?.querySelector('.hint');
    expect(hint?.textContent).toContain('✓ 6 strings');
  });

  it('generates voicing blocks for the default progression', async () => {
    await generate();
    const cards = el().querySelectorAll('.chord-card').length;
    expect(cards).toBeGreaterThanOrEqual(3);
    expect(cards).toBeLessThanOrEqual(6);
  });

  it('generates voicings for extended and altered chords', async () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'C13, G7b13';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await generate();
    expect(el().querySelectorAll('.chord-card').length).toBe(2);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(0);

    expect(el().textContent).toContain('tones C E G A# D (F) (A)');
  });

  it('generates a single card for slash chords and parenthesized alterations', async () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'A7(#5)/C#, Dm9';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await generate();
    expect(el().querySelectorAll('.chord-card').length).toBe(2);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(0);
  });

  it('reports a tuning parse error instead of generating', async () => {
    const tuningInput = fieldInput('custom');
    if (!tuningInput) throw new Error('tuning input missing');
    tuningInput.value = 'E2 X2';
    tuningInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await generate();
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('requires a progression before generating', async () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = '';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await generate();
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('switches between tab and diagram renderings', async () => {
    await generate();
    expect(el().querySelectorAll('app-neck-diagram').length).toBeGreaterThan(0);

    el().querySelectorAll<HTMLButtonElement>('.rail-group button[role="radio"]')[0].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('app-neck-diagram').length).toBe(0);
    expect(el().querySelectorAll('.tab-line').length).toBeGreaterThan(0);
  });

  it('shows detected key after generating', async () => {
    const input = fieldInput('chords, comma-separated')!;
    input.value = 'C, F, G';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await generate();
    expect(el().querySelector('.key-row')?.textContent).toContain('Key: C major');
    expect(el().querySelector('.legend')).toBeNull();
  });

  it('lists the candidate keys alongside the detected key', async () => {
    const input = fieldInput('chords, comma-separated')!;
    input.value = 'Fmaj7, Fm(maj7), C/E, C#dim/E';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await generate();

    const keyButton = el().querySelector<HTMLButtonElement>('.key-row button')!;
    expect(keyButton.textContent).toContain('Key: C major');
    expect(keyButton.getAttribute('aria-pressed')).toBe('false');
    expect(el().querySelector('.key-alternatives')).toBeNull();

    keyButton.click();
    fixture.detectChanges();
    expect(keyButton.getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('.key-alternatives')?.textContent).toContain('F major, D minor');
  });

  it('marks each chord with its roman numeral and explains it to screen readers', async () => {
    const input = fieldInput('chords, comma-separated')!;
    input.value = 'Fmaj7, Fm(maj7), C/E, C#dim/E';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await generate();

    const chips = [...el().querySelectorAll<HTMLElement>('.numeral-chip')];
    expect(chips.map((chip) => chip.querySelector('[aria-hidden]')?.textContent)).toEqual([
      'IV',
      'IV',
      'I',
      '—',
    ]);
    expect(chips[0].querySelector('.sr-only')?.textContent).toBe('diatonic to C major');
    expect(chips[1].classList).toContain('warn');
    expect(chips[3].classList).toContain('bad');
  });

  it('clears results back to an empty stage', async () => {
    await generate();
    expect(el().querySelectorAll('.chord-card').length).toBeGreaterThan(0);

    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 1].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('refuses to copy before anything was generated', async () => {
    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    const copyButton = toolbarButtons[toolbarButtons.length - 2];
    expect(copyButton.textContent?.trim()).toBe('copy tab');

    copyButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(copyButton.textContent?.trim()).toBe('copy tab');
    expect(el().querySelectorAll('.chord-card').length).toBe(0);
  });

  it('generates a progression with an invalid chord token in the middle without misaligning', async () => {
    const progressionInput = fieldInput('chords, comma-separated');
    if (!progressionInput) throw new Error('progression input missing');
    progressionInput.value = 'Cm, NOTACHORD, G';
    progressionInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await generate();

    expect(el().querySelectorAll('.chord-card').length).toBe(3);
    expect(el().querySelectorAll('.chord-card .card-note.error').length).toBe(1);
  });

  it('closes the tuning list when the instrument list opens', () => {
    const triggers = el().querySelectorAll<HTMLButtonElement>('.controls-panel app-listbox .btn');
    triggers[1].click();
    fixture.detectChanges();
    expect(el().querySelector('[aria-label="Tuning preset"]')).toBeTruthy();

    triggers[0].click();
    fixture.detectChanges();
    expect(el().querySelector('[aria-label="Tuning preset"]')).toBeFalsy();
    expect(el().querySelector('[aria-label="Instrument"]')).toBeTruthy();
  });

  it('switches instrument and resyncs the tuning text field', () => {
    const triggers = el().querySelectorAll<HTMLButtonElement>('.controls-panel app-listbox .btn');
    const instrumentTrigger = triggers[0];
    expect(instrumentTrigger.textContent).toContain('Guitar');

    instrumentTrigger.click();
    fixture.detectChanges();

    const menu = el().querySelector('[aria-label="Instrument"]');
    if (!menu) throw new Error('instrument menu missing');
    const option = [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((b) =>
      b.textContent?.includes('Ukulele'),
    );
    if (!option) throw new Error('ukulele option missing');
    option.click();
    fixture.detectChanges();

    expect(instrumentTrigger.textContent).toContain('Ukulele');
    expect(fieldInput('custom')?.value).toBe('G4 C4 E4 A4');
  });

  describe('fingerings per chord', () => {
    const stepper = (label: string): HTMLButtonElement =>
      el().querySelector<HTMLButtonElement>(`app-step-button button[aria-label="${label}"]`)!;
    const countValue = (): string => el().querySelector('.count-value')!.textContent.trim();
    const shapesInFirstCard = (): number =>
      el().querySelector('.chord-card')!.querySelectorAll('.card-shape').length;
    const press = (label: string): void => {
      stepper(label).click();
      fixture.detectChanges();
    };

    beforeEach(async () => {
      const input = fieldInput('chords, comma-separated')!;
      input.value = 'C';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await generate();
    });

    it('shows six fingerings by default', () => {
      expect(countValue()).toBe('6');
      expect(shapesInFirstCard()).toBe(6);
    });

    it('shows more or fewer fingerings without regenerating', () => {
      press('Show more fingerings per chord');
      expect(countValue()).toBe('7');
      expect(shapesInFirstCard()).toBe(7);

      press('Show fewer fingerings per chord');
      press('Show fewer fingerings per chord');
      expect(countValue()).toBe('5');
      expect(shapesInFirstCard()).toBe(5);
    });

    it('copies only the fingerings on screen', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      press('Show fewer fingerings per chord');

      const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
      toolbarButtons[toolbarButtons.length - 2].click();
      await fixture.whenStable();

      const copied = writeText.mock.calls[0][0] as string;
      expect(copied.match(/=== C - Fingering/g)).toHaveLength(5);
    });

    it('passes axe with the stepper in the rail', async () => {
      const results = await axe(el());
      expect(results).toHaveNoViolations();
    });
  });
});

class FakeVoicingWorker {
  static created: FakeVoicingWorker[] = [];
  onmessage: ((event: MessageEvent<VoicingSearchMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: VoicingSearchRequest[] = [];
  terminated = false;

  constructor() {
    FakeVoicingWorker.created.push(this);
  }

  postMessage(request: VoicingSearchRequest): void {
    this.posted.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  get runId(): number {
    return this.posted[this.posted.length - 1].runId;
  }

  emit(message: VoicingSearchMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<VoicingSearchMessage>);
  }

  finish(): void {
    const request = this.posted[this.posted.length - 1];
    this.emit({ kind: 'result', runId: request.runId, shapes: request.chords.map(() => []) });
  }
}

describe('ChordFinder with the voicing worker', () => {
  let fixture: ComponentFixture<ChordFinder>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const status = (): HTMLElement | null => el().querySelector('.stage-well [role="status"]');
  const well = (): HTMLElement => el().querySelector<HTMLElement>('.stage-well')!;
  const latest = (): FakeVoicingWorker =>
    FakeVoicingWorker.created[FakeVoicingWorker.created.length - 1];

  const render = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const setProgression = (value: string): void => {
    const label = [...el().querySelectorAll<HTMLLabelElement>('label')].find((candidate) =>
      candidate.textContent?.includes('chords, comma-separated'),
    )!;
    const input = el().querySelector<HTMLInputElement>(`#${label.getAttribute('for')}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const pressGenerate = (): void => {
    el().querySelector<HTMLButtonElement>('.generate')!.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    FakeVoicingWorker.created = [];
    await TestBed.configureTestingModule({
      imports: [ChordFinder],
      providers: [
        { provide: SCALE_PREFERENCES_STORAGE, useValue: null },
        {
          provide: VOICING_WORKER_FACTORY,
          useValue: () => new FakeVoicingWorker() as unknown as Worker,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChordFinder);
    await render();
    setProgression('C, G, NOTACHORD');
  });

  it('sends the chords to the worker and shows progress while it searches', async () => {
    pressGenerate();

    const request = latest().posted[0];
    expect(request.chords.map((c) => c?.symbol ?? null)).toEqual(['C', 'G', null]);
    expect(status()?.textContent).toContain('Finding voicings · 0 of 3 chords');
    expect(well().classList).toContain('searching');

    latest().emit({ kind: 'progress', runId: request.runId, done: 2, total: 3 });
    fixture.detectChanges();
    expect(status()?.textContent).toContain('2 of 3 chords');

    latest().finish();
    await render();
    expect(status()).toBeNull();
    expect(well().classList).not.toContain('searching');
    expect(el().querySelectorAll('.chord-card')).toHaveLength(3);
  });

  it('keeps the previous results in place while a new search runs', async () => {
    pressGenerate();
    latest().finish();
    await render();
    const card = el().querySelector('.chord-card');

    setProgression('Am, F');
    pressGenerate();
    expect(status()).not.toBeNull();
    expect(el().querySelector('.chord-card')).toBe(card);
    expect(el().querySelectorAll('.chord-card')).toHaveLength(3);
  });

  it('cancels the running search when Generate is pressed again', async () => {
    pressGenerate();
    const stale = latest();
    const staleRunId = stale.runId;

    setProgression('Am, F');
    pressGenerate();
    expect(stale.terminated).toBe(true);

    stale.emit({
      kind: 'result',
      runId: staleRunId,
      shapes: [[], [], []],
    });
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(el().querySelectorAll('.chord-card')).toHaveLength(0);
    expect(status()?.textContent).toContain('0 of 2 chords');

    latest().finish();
    await render();
    const headings = [...el().querySelectorAll('.chord-card h3')].map((h) => h.textContent);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toContain('Am');
    expect(status()).toBeNull();
  });

  it('stops the search and hides the indicator when cleared', async () => {
    pressGenerate();
    const worker = latest();

    const toolbarButtons = el().querySelectorAll<HTMLButtonElement>('.control-rail .btn');
    toolbarButtons[toolbarButtons.length - 1].click();
    await render();

    expect(worker.terminated).toBe(true);
    expect(status()).toBeNull();
    expect(el().querySelectorAll('.chord-card')).toHaveLength(0);
  });

  it('stops the search when the page is left', () => {
    pressGenerate();
    const worker = latest();
    fixture.destroy();
    expect(worker.terminated).toBe(true);
  });

  it('passes axe while the indicator is showing', async () => {
    pressGenerate();
    latest().finish();
    await render();
    pressGenerate();
    expect(status()).not.toBeNull();

    const results = await axe(el());
    expect(results).toHaveNoViolations();
  });
});
