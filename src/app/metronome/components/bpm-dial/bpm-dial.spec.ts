import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BpmDial } from './bpm-dial';

describe('BpmDial', () => {
  let fixture: ComponentFixture<BpmDial>;
  let dial: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BpmDial] }).compileComponents();
    fixture = TestBed.createComponent(BpmDial);
    fixture.componentRef.setInput('bpm', 100);
    fixture.detectChanges();
    dial = fixture.nativeElement.querySelector('[role="slider"]') as HTMLElement;
  });

  afterEach(() => fixture?.destroy());

  it('exposes slider semantics with the current bpm', () => {
    expect(dial.getAttribute('role')).toBe('slider');
    expect(dial.getAttribute('aria-valuenow')).toBe('100');
    expect(dial.getAttribute('aria-valuemin')).toBe('1');
    expect(dial.getAttribute('aria-valuemax')).toBe('800');
    expect(dial.getAttribute('aria-label')).toBe('Tempo');
  });

  it('renders one tick mark per rotation and a tap button', () => {
    expect(fixture.nativeElement.querySelectorAll('.dial-tick').length).toBe(55);
    expect(fixture.nativeElement.querySelector('.tap-btn')).toBeTruthy();
  });

  it('tracks external bpm changes by rotating the face', () => {
    const face = fixture.nativeElement.querySelector('.dial-face') as SVGGElement;
    expect(face.getAttribute('transform')).toContain('rotate(648 150 150)');
    fixture.componentRef.setInput('bpm', 56);
    fixture.detectChanges();
    expect(face.getAttribute('transform')).toContain('rotate(360 150 150)');
  });

  it('emits bpmChange on arrow keys with shift multiplier', () => {
    const emitted: number[] = [];
    fixture.componentInstance.bpmChange.subscribe((v) => emitted.push(v));

    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(emitted).toEqual([101]);

    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
    expect(emitted).toEqual([101, 95]);

    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(emitted).toEqual([101, 95, 1, 800]);
  });

  it('clamps keyboard values to the dial range', () => {
    const emitted: number[] = [];
    fixture.componentInstance.bpmChange.subscribe((v) => emitted.push(v));
    fixture.componentRef.setInput('bpm', 800);
    fixture.detectChanges();

    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(emitted).toEqual([800]);
  });

  it('emits tap when the center button is activated', () => {
    let taps = 0;
    fixture.componentInstance.tap.subscribe(() => taps++);
    const tapBtn = fixture.nativeElement.querySelector('.tap-btn') as HTMLButtonElement;
    tapBtn.click();
    expect(taps).toBe(1);
  });

  it('spins the face on drag and emits the resulting bpm', () => {
    const emitted: number[] = [];
    fixture.componentInstance.bpmChange.subscribe((v) => emitted.push(v));

    // Give the dial a real size so angle math has a center.
    Object.defineProperty(dial, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 }),
    });

    dial.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 0 }));
    // Rotate the pointer 90° clockwise (from 12 o'clock to 3 o'clock).
    dial.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 100 }));
    dial.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 200, clientY: 100 }));

    expect(emitted.length).toBeGreaterThan(0);
    // 90° = 90 / (360/55) ≈ 13.75 ticks → 100 + 14 = 114 (clockwise drag
    // increases the BPM, matching the meter's natural direction).
    expect(emitted[emitted.length - 1]).toBe(114);
  });

  it('keeps the tap button from starting a drag', () => {
    let emitted = 0;
    fixture.componentInstance.bpmChange.subscribe(() => emitted++);
    const tapBtn = fixture.nativeElement.querySelector('.tap-btn') as HTMLButtonElement;
    tapBtn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    expect(emitted).toBe(0);
  });
});
