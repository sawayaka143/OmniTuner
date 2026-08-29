import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { ColorField } from './color-field';

describe('ColorField', () => {
  let component: ColorField;
  let fixture: ComponentFixture<ColorField>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const entry = (): HTMLInputElement => el().querySelector<HTMLInputElement>('.entry')!;

  const type = (value: string): void => {
    entry().value = value;
    entry().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColorField],
    }).compileComponents();

    fixture = TestBed.createComponent(ColorField);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Background');
    fixture.componentRef.setInput('value', '#121211');
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the current value in the text entry', () => {
    expect(entry().value).toBe('#121211');
    expect(el().querySelector('.value-note')?.textContent).toContain('#121211');
  });

  it('emits normalized hex for RGB triplets', () => {
    let received: string | null = null;
    fixture.componentRef.setInput('value', '#121211');
    component.valueChange.subscribe((value) => (received = value));

    type('255, 255, 0');
    expect(received).toBe('#ffff00');
  });

  it('emits normalized hex for hex input', () => {
    let received: string | null = null;
    component.valueChange.subscribe((value) => (received = value));

    type('#F00');
    expect(received).toBe('#ff0000');
  });

  it('marks invalid input without emitting', () => {
    let received: string | null = null;
    component.valueChange.subscribe((value) => (received = value));

    type('not-a-color');
    expect(received).toBeNull();
    expect(entry().getAttribute('aria-invalid')).toBe('true');
    expect(el().querySelector('.value-note')?.textContent).toContain('use #hex or r, g, b');
  });

  it('restores the current value after invalid input blurs', () => {
    type('not-a-color');
    entry().dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(entry().value).toBe('#121211');
    expect(entry().getAttribute('aria-invalid')).toBeNull();
  });

  it('emits the picked color from the native swatch and syncs the entry', () => {
    component.valueChange.subscribe((value) => fixture.componentRef.setInput('value', value));

    type('#123456');
    expect(entry().value).toBe('#123456');

    const picker = el().querySelector<HTMLInputElement>('.swatch')!;
    picker.value = '#abcdef';
    picker.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(entry().value).toBe('#abcdef');
  });

  it('shows the auto hint when no value is set', () => {
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();
    expect(el().querySelector('.value-note')?.textContent).toContain('auto');
    expect(entry().value).toBe('');
  });

  it('has no axe violations', async () => {
    const results = await axe(el());
    expect(results).toHaveNoViolations();
  });
});
