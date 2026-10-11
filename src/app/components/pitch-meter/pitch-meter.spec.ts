import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PitchMeter, Tick } from './pitch-meter';

const TICKS: readonly Tick[] = [
  { leftPos: '0%', type: 'normal' },
  { leftPos: '50%', type: 'center' },
  { leftPos: '100%', type: 'major' },
];

@Component({
  selector: 'app-pm-host',
  template: `
    <app-pitch-meter
      [ticks]="ticks()"
      [needleLeft]="needle()"
      [isTuned]="tuned()"
      [cents]="cents()"
      [stale]="stale()"
      [tolerance]="tolerance()"
    />
  `,
  imports: [PitchMeter],
})
class PitchMeterHost {
  readonly ticks = signal<Tick[]>([...TICKS]);
  readonly needle = signal('50%');
  readonly tuned = signal(false);
  readonly cents = signal<number | null>(null);
  readonly stale = signal(false);
  readonly tolerance = signal<number | null>(null);
}

describe('PitchMeter', () => {
  let fixture: ComponentFixture<PitchMeterHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PitchMeterHost] }).compileComponents();
    fixture = TestBed.createComponent(PitchMeterHost);
    fixture.detectChanges();
  });

  const el = (selector: string): HTMLElement =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;

  it('should be created', () => {
    expect(fixture.nativeElement.querySelector('app-pitch-meter')).toBeTruthy();
  });

  it('renders one tick per input with its emphasis class and position', () => {
    const ticks = [...fixture.nativeElement.querySelectorAll('.meter-tick')] as HTMLElement[];
    expect(ticks.length).toBe(3);
    expect(ticks[1].classList.contains('center')).toBe(true);
    expect(ticks[2].classList.contains('major')).toBe(true);
    expect(ticks[0].getAttribute('style')).toContain('left: 0%');
  });

  it('shades the in-tune tolerance band around the centre', () => {
    expect(el('.tolerance-zone')).toBeNull();

    fixture.componentInstance.tolerance.set(5);
    fixture.detectChanges();

    const zone = el('.tolerance-zone');
    expect(zone.style.left).toBe('45%');
    expect(zone.style.width).toBe('10%');
    expect(zone.classList.contains('active')).toBe(false);

    fixture.componentInstance.tuned.set(true);
    fixture.detectChanges();
    expect(zone.classList.contains('active')).toBe(true);
  });

  it('caps the tolerance band at the ends of the ruler and hides it for zero', () => {
    fixture.componentInstance.tolerance.set(80);
    fixture.detectChanges();
    expect(el('.tolerance-zone').style.width).toBe('100%');

    fixture.componentInstance.tolerance.set(0);
    fixture.detectChanges();
    expect(el('.tolerance-zone')).toBeNull();
  });

  it('places the needle and marks it in tune', () => {
    expect(el('.meter-needle').getAttribute('style')).toContain('left: 50%');

    fixture.componentInstance.tuned.set(true);
    fixture.detectChanges();
    expect(el('.meter-needle').classList.contains('in-tune')).toBe(true);
  });

  it('dims the needle while it shows a held reading', () => {
    expect(el('.meter-needle').classList.contains('stale')).toBe(false);

    fixture.componentInstance.stale.set(true);
    fixture.detectChanges();
    expect(el('.meter-needle').classList.contains('stale')).toBe(true);
  });

  it('labels the cents scale and exposes the clamped value to assistive tech', () => {
    const meter = el('.horizontal-meter');
    expect(meter.getAttribute('aria-valuemin')).toBe('-50');
    expect(meter.getAttribute('aria-valuemax')).toBe('50');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');

    fixture.componentInstance.cents.set(-37.4);
    fixture.detectChanges();
    expect(meter.getAttribute('aria-valuenow')).toBe('-37.4');

    fixture.componentInstance.cents.set(120);
    fixture.detectChanges();
    expect(meter.getAttribute('aria-valuenow')).toBe('50');

    fixture.componentInstance.cents.set(-120);
    fixture.detectChanges();
    expect(meter.getAttribute('aria-valuenow')).toBe('-50');
  });

  it('renders the fixed cents scale labels with the centre emphasised', () => {
    const labels = [
      ...fixture.nativeElement.querySelectorAll('.meter-labels span'),
    ] as HTMLElement[];
    expect([...labels].map((label) => label.textContent?.trim())).toEqual([
      '-50',
      '-25',
      '0',
      '+25',
      '+50',
    ]);
    expect(labels[2].classList.contains('center-label')).toBe(true);
  });
});
