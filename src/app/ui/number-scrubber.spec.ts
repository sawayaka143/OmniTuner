import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberScrubber } from './number-scrubber';

@Component({
  selector: 'app-ns-host',
  template: `<input
    type="number"
    min="1"
    max="800"
    step="1"
    [value]="value()"
    (change)="onChange($any($event.target).valueAsNumber)"
  />`,
  imports: [NumberScrubber],
})
class NsHost {
  readonly value = signal(130);
  readonly committed = signal<number | null>(null);
  protected onChange(v: number): void {
    this.value.set(v);
    this.committed.set(v);
  }
}

describe('NumberScrubber', () => {
  let fixture: ComponentFixture<NsHost>;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NsHost] }).compileComponents();
    fixture = TestBed.createComponent(NsHost);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  const drag = (fromY: number, toY: number, modifiers: PointerEventInit = {}): void => {
    input.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: fromY }));
    input.dispatchEvent(new PointerEvent('pointermove', { clientY: toY, ...modifiers }));
    input.dispatchEvent(new PointerEvent('pointerup', { clientY: toY, ...modifiers }));
  };

  it('does not change the value on a plain click', () => {
    input.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: 100 }));
    input.dispatchEvent(new PointerEvent('pointerup', { clientY: 100 }));
    expect(input.valueAsNumber).toBe(130);
    expect(fixture.componentInstance.committed()).toBeNull();
  });

  it('increases the value when dragged up and commits on release', () => {
    drag(100, 60);
    expect(input.valueAsNumber).toBe(140);
    expect(fixture.componentInstance.committed()).toBe(140);
  });

  it('decreases the value when dragged down', () => {
    drag(100, 124);
    expect(input.valueAsNumber).toBe(124);
    expect(fixture.componentInstance.committed()).toBe(124);
  });

  it('scrubs in finer increments while shift is held', () => {
    drag(100, 60, { shiftKey: true });
    expect(input.valueAsNumber).toBe(132);
    expect(fixture.componentInstance.committed()).toBe(132);
  });

  it('clamps to the min/max attributes', () => {
    drag(100, -2900);
    expect(input.valueAsNumber).toBe(800);

    drag(100, 3400);
    expect(input.valueAsNumber).toBe(1);
  });

  it('ignores non-primary buttons', () => {
    input.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientY: 100 }));
    input.dispatchEvent(new PointerEvent('pointermove', { clientY: 60 }));
    input.dispatchEvent(new PointerEvent('pointerup', { clientY: 60 }));
    expect(input.valueAsNumber).toBe(130);
  });

  it('restores text selection behavior after the drag ends', () => {
    drag(100, 60);
    expect(input.style.userSelect).toBe('');
  });
});
