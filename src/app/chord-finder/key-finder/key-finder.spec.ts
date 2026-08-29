import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { KeyFinder } from './key-finder';

describe('KeyFinder', () => {
  let component: KeyFinder;
  let fixture: ComponentFixture<KeyFinder>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const setInput = (value: string): void => {
    const label = [...el().querySelectorAll<HTMLLabelElement>('label')].find((candidate) =>
      candidate.textContent?.includes('chords, comma-separated'),
    );
    if (!label) throw new Error('key finder input missing');
    const id = label.getAttribute('for');
    const input = el().querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error('key finder input missing');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const keyText = (): string => el().querySelector('.key-primary')?.textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyFinder],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyFinder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the idle prompt before any chords are entered', () => {
    expect(el().querySelector('.key-primary')).toBeNull();
    expect(el().querySelector('.key-empty')?.textContent).toContain(
      'type chords above to detect the key',
    );
  });

  it('detects C Ionian with strong confidence for C, F, G', () => {
    setInput('C, F, G');
    expect(keyText()).toContain('C Ionian');
    expect(keyText()).toContain('strong');
    expect(el().querySelector('.key-primary')?.classList.contains('good')).toBe(true);
  });

  it('resolves Am, Dm, E to C Ionian per the documented tie-break', () => {
    setInput('Am, Dm, E');
    expect(keyText()).toContain('C Ionian');
  });

  it('spells flat keys for Bb, Eb, F', () => {
    setInput('Bb, Eb, F');
    expect(keyText()).toContain('Bb Ionian');
  });

  it('lists alternative keys', () => {
    setInput('C, F, G');
    expect(el().querySelector('.key-alternatives')?.textContent).toContain('also fits:');
  });

  it('reports unreadable tokens in the live hint', () => {
    setInput('Cm, NOTACHORD, G');
    const hint = el().querySelector('.hint')?.textContent ?? '';
    expect(hint).toContain('3 chords parsed · 2 readable');
    expect(keyText()).not.toContain('NOTACHORD');
  });

  it('shows an error state when no chord is readable', () => {
    setInput('NOTACHORD');
    expect(el().querySelector('.key-primary')).toBeNull();
    const empty = el().querySelector('.key-empty');
    expect(empty?.textContent).toContain('no readable chords');
    expect(empty?.classList.contains('bad')).toBe(true);
  });

  it('has no axe violations with results shown', async () => {
    setInput('C, F, G');
    const results = await axe(el());
    expect(results).toHaveNoViolations();
  });
});
