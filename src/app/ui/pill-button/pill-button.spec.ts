import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PillButton } from './pill-button';

describe('PillButton', () => {
  let fixture: ComponentFixture<PillButton>;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PillButton] }).compileComponents();
    fixture = TestBed.createComponent(PillButton);
    fixture.componentRef.setInput('label', 'Save');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => fixture?.destroy());

  it('renders the label text', () => {
    expect(button.textContent?.trim()).toBe('Save');
  });

  it('defaults to ghost variant and button type', () => {
    expect(button.classList.contains('primary')).toBe(false);
    expect(button.type).toBe('button');
  });

  it('applies primary class for the primary variant', () => {
    fixture.componentRef.setInput('variant', 'primary');
    fixture.detectChanges();
    expect(button.classList.contains('primary')).toBe(true);
  });

  it('uses the submit type when configured', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();
    expect(button.type).toBe('submit');
  });

  it('omits aria-pressed and the active class when pressed is null', () => {
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.classList.contains('active')).toBe(false);
  });

  it('exposes aria-pressed=true and the active class when pressed is true', () => {
    fixture.componentRef.setInput('pressed', true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('active')).toBe(true);
  });

  it('exposes aria-pressed=false and still the active class when pressed is false', () => {
    fixture.componentRef.setInput('pressed', false);
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList.contains('active')).toBe(true);
  });

  it('renders no icon when neither iconOn nor iconOff is provided', () => {
    expect(button.querySelector('.material-symbols-outlined')).toBeNull();
  });

  it('renders the iconOn glyph when only iconOn is provided', () => {
    fixture.componentRef.setInput('iconOn', 'play_arrow');
    fixture.detectChanges();
    const span = button.querySelector('.material-symbols-outlined') as HTMLSpanElement;
    expect(span.textContent).toBe('play_arrow');
  });

  it('swaps to iconOff when pressed is false and both icons are provided', () => {
    fixture.componentRef.setInput('iconOn', 'graphic_eq');
    fixture.componentRef.setInput('iconOff', 'play_arrow');
    fixture.componentRef.setInput('pressed', false);
    fixture.detectChanges();
    const span = button.querySelector('.material-symbols-outlined') as HTMLSpanElement;
    expect(span.textContent).toBe('play_arrow');
  });

  it('shows iconOn when pressed is true and both icons are provided', () => {
    fixture.componentRef.setInput('iconOn', 'graphic_eq');
    fixture.componentRef.setInput('iconOff', 'play_arrow');
    fixture.componentRef.setInput('pressed', true);
    fixture.detectChanges();
    const span = button.querySelector('.material-symbols-outlined') as HTMLSpanElement;
    expect(span.textContent).toBe('graphic_eq');
  });

  it('disables when disabled is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('emits activate on click', () => {
    let calls = 0;
    fixture.componentInstance.activate.subscribe(() => (calls += 1));
    button.click();
    expect(calls).toBe(1);
  });
});
