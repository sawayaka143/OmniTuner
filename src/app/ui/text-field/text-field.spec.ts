import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextField } from './text-field';

@Component({
  selector: 'app-tf-host',
  template: `
    <app-text-field
      label="Tuning"
      [type]="typeValue()"
      [value]="value()"
      [min]="minValue()"
      [max]="maxValue()"
      [invalid]="invalid()"
      [errorMessage]="errorMessage()"
      [hint]="hint()"
      [hintTone]="hintTone()"
      placeholder="C"
      [maxlength]="40"
      [required]="true"
      [autofocus]="true"
      (valueChange)="onValue($event)"
      (enter)="onEnter()"
    />
  `,
  imports: [TextField],
})
class TfHost {
  readonly value = signal('hello');
  readonly typeValue = signal<'text' | 'number'>('text');
  readonly minValue = signal<number | undefined>(undefined);
  readonly maxValue = signal<number | undefined>(undefined);
  readonly invalid = signal(false);
  readonly errorMessage = signal('');
  readonly hint = signal('');
  readonly hintTone = signal<'good' | 'bad' | 'neutral'>('neutral');
  readonly enters = signal(0);
  onValue(v: string): void {
    this.value.set(v);
  }
  onEnter(): void {
    this.enters.update((n) => n + 1);
  }
}

describe('TextField', () => {
  let fixture: ComponentFixture<TfHost>;
  let host: TfHost;
  let input: HTMLInputElement;
  let label: HTMLLabelElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TfHost] }).compileComponents();
    fixture = TestBed.createComponent(TfHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
  });

  afterEach(() => fixture?.destroy());

  it('renders the label bound to the input via for/id', () => {
    expect(label.textContent).toBe('Tuning');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).toContain('app-text-field-');
  });

  it('passes through static attributes', () => {
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('C');
    expect(input.maxLength).toBe(40);
    expect(input.required).toBe(true);
    expect(input.autofocus).toBe(true);
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('emits valueChange on input with the new value', () => {
    input.value = 'world';
    input.dispatchEvent(new Event('input'));
    expect(host.value()).toBe('world');
  });

  it('emits enter on Enter keydown', () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.enters()).toBe(1);
  });

  it('omits aria-invalid when no error and invalid is false', () => {
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('sets aria-invalid when invalid is true', () => {
    host.invalid.set(true);
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('sets aria-invalid when an errorMessage is provided (without invalid=true)', () => {
    host.errorMessage.set('Bad value');
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders the error message and wires aria-describedby to it', () => {
    host.errorMessage.set('Bad value');
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.field-error') as HTMLElement;
    expect(error.textContent).toBe('Bad value');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('renders the hint when no error and wires aria-describedby to it', () => {
    host.hint.set('Looking good');
    host.hintTone.set('good');
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('.hint') as HTMLElement;
    expect(hint.textContent).toBe('Looking good');
    expect(hint.classList.contains('good')).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('prefers the error message over the hint when both are set', () => {
    host.hint.set('A hint');
    host.errorMessage.set('An error');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hint')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('applies good/bad tone classes to the hint', () => {
    host.hint.set('bad news');
    host.hintTone.set('bad');
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('.hint') as HTMLElement;
    expect(hint.classList.contains('bad')).toBe(true);
    expect(hint.classList.contains('good')).toBe(false);
  });

  it('omits aria-describedby when neither error nor hint is provided', () => {
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('supports type=number with min/max/step bound to attributes', () => {
    host.typeValue.set('number');
    host.value.set('3');
    host.minValue.set(1);
    host.maxValue.set(6);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('1');
    expect(input.max).toBe('6');
  });
});