import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Toggle } from './toggle';

describe('Toggle', () => {
  let fixture: ComponentFixture<Toggle>;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toggle] }).compileComponents();
    fixture = TestBed.createComponent(Toggle);
    fixture.componentRef.setInput('checked', false);
    fixture.componentRef.setInput('label', 'Glow');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => fixture?.destroy());

  it('uses switch semantics by default (role=switch, aria-checked, no inline text)', () => {
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.textContent?.trim()).toBe('');
  });

  it('exposes the label via aria-label in switch mode', () => {
    expect(button.getAttribute('aria-label')).toBe('Glow');
  });

  it('switches to press semantics when inline is true and renders the label text', () => {
    fixture.componentRef.setInput('inline', true);
    fixture.detectChanges();
    expect(button.hasAttribute('role')).toBe(false);
    expect(button.hasAttribute('aria-checked')).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList.contains('inline')).toBe(true);
    expect(button.textContent?.trim()).toBe('Glow');
  });

  it('omits aria-label in inline mode (label is the visible text)', () => {
    fixture.componentRef.setInput('inline', true);
    fixture.detectChanges();
    expect(button.hasAttribute('aria-label')).toBe(false);
  });

  it('reflects the checked state via aria-checked in switch mode', () => {
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.classList.contains('active')).toBe(true);
  });

  it('reflects the checked state via aria-pressed in inline mode', () => {
    fixture.componentRef.setInput('inline', true);
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('active')).toBe(true);
  });

  it('emits the inverted value on click', () => {
    const emitted: boolean[] = [];
    fixture.componentInstance.change.subscribe((v) => emitted.push(v));
    button.click();
    expect(emitted).toEqual([true]);
  });

  it('does not emit or toggle while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    const emitted: boolean[] = [];
    fixture.componentInstance.change.subscribe((v) => emitted.push(v));
    button.click();
    expect(emitted).toEqual([]);
  });

  it('exposes the title attribute in switch mode when title is set', () => {
    fixture.componentRef.setInput('title', 'Hover note');
    fixture.detectChanges();
    expect(button.getAttribute('title')).toBe('Hover note');
  });

  it('omits the title attribute in inline mode even when title is set', () => {
    fixture.componentRef.setInput('inline', true);
    fixture.componentRef.setInput('title', 'Hover note');
    fixture.detectChanges();
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('applies the prominent class when prominent is true', () => {
    fixture.componentRef.setInput('inline', true);
    fixture.componentRef.setInput('prominent', true);
    fixture.detectChanges();
    expect(button.classList.contains('prominent')).toBe(true);
  });

  it('omits the prominent class by default', () => {
    expect(button.classList.contains('prominent')).toBe(false);
  });
});
