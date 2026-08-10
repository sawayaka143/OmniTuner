import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepButton } from './step-button';

describe('StepButton', () => {
  let fixture: ComponentFixture<StepButton>;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StepButton] }).compileComponents();
    fixture = TestBed.createComponent(StepButton);
    fixture.componentRef.setInput('direction', 1);
    fixture.componentRef.setInput('value', 50);
    fixture.componentRef.setInput('min', 24);
    fixture.componentRef.setInput('max', 96);
    fixture.componentRef.setInput('ariaLabel', 'Raise by one semitone');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => fixture?.destroy());

  it('renders the + glyph for direction 1', () => {
    expect(button.querySelector('span')?.textContent).toBe('+');
  });

  it('renders the − glyph for direction -1', () => {
    fixture.componentRef.setInput('direction', -1);
    fixture.detectChanges();
    expect(button.querySelector('span')?.textContent).toBe('−');
  });

  it('uses the ariaLabel input as aria-label', () => {
    expect(button.getAttribute('aria-label')).toBe('Raise by one semitone');
  });

  it('emits the next clamped value on click (keyboard)', () => {
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(emitted).toEqual([51]);
  });

  it('emits on pointerdown', () => {
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new PointerEvent('pointerdown'));
    expect(emitted).toEqual([51]);
  });

  it('repeats while pressed', async () => {
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => {
      emitted.push(v);
      fixture.componentRef.setInput('value', v);
    });

    button.dispatchEvent(new PointerEvent('pointerdown'));
    await new Promise((r) => setTimeout(r, 540));
    expect(emitted.length).toBeGreaterThanOrEqual(2);
    expect(emitted[0]).toBe(51);
    expect(emitted[1]).toBe(52);

    button.dispatchEvent(new PointerEvent('pointerup'));
    const countAtRelease = emitted.length;
    await new Promise((r) => setTimeout(r, 200));
    expect(emitted.length).toBe(countAtRelease);
  });

  it('disables the button when value is at the upper limit and direction is +1', () => {
    fixture.componentRef.setInput('value', 96);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Raise by one semitone');
  });

  it('disables the button when value is at the lower limit and direction is -1', () => {
    fixture.componentRef.setInput('direction', -1);
    fixture.componentRef.setInput('value', 24);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('does not emit when at the limit (button is disabled, no native click)', () => {
    fixture.componentRef.setInput('value', 96);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new PointerEvent('pointerdown'));
    expect(emitted).toEqual([]);
  });

  it('reflects an external disabled input independently of the value limits', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('clamps to the max when a step would exceed it', () => {
    fixture.componentRef.setInput('value', 95);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(emitted).toEqual([96]);
  });

  it('clamps to the min when a step would go below it', () => {
    fixture.componentRef.setInput('direction', -1);
    fixture.componentRef.setInput('value', 25);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(emitted).toEqual([24]);
  });

  it('does not emit when the clamped value equals the current value', () => {
    fixture.componentRef.setInput('value', 96);
    fixture.componentRef.setInput('min', 24);
    fixture.componentRef.setInput('max', 100);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    const emitted: number[] = [];
    fixture.componentInstance.step.subscribe((v) => emitted.push(v));
    button.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(emitted).toEqual([97]);
  });
});