import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PitchDisplay } from './pitch-display';

@Component({
  selector: 'app-pd-host',
  template: `
    <app-pitch-display
      [noteName]="note()"
      [octave]="octave()"
      [hz]="hz()"
      [statusMessage]="status()"
      [isLocked]="locked()"
      [isTuned]="tuned()"
      [tuneColor]="color()"
    />
  `,
  imports: [PitchDisplay],
})
class PitchDisplayHost {
  readonly note = signal<string | null>('E');
  readonly octave = signal<number | null>(2);
  readonly hz = signal('110.00 Hz');
  readonly status = signal('TUNING E2');
  readonly locked = signal(false);
  readonly tuned = signal(false);
  readonly color = signal<string | null>(null);
}

describe('PitchDisplay', () => {
  let fixture: ComponentFixture<PitchDisplayHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PitchDisplayHost] }).compileComponents();
    fixture = TestBed.createComponent(PitchDisplayHost);
    fixture.detectChanges();
  });

  const el = (selector: string): HTMLElement =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;

  it('should be created', () => {
    const display = fixture.nativeElement.querySelector('app-pitch-display');
    expect(display).toBeTruthy();
  });

  it('renders the note, octave, hertz readout, and status message', () => {
    expect(el('.pitch-note').textContent?.trim()).toBe('E');
    expect(el('.pitch-octave').textContent?.trim()).toBe('2');
    expect(el('.pitch-hz').textContent?.trim()).toBe('110.00 Hz');
    expect(el('.pitch-status').textContent?.trim()).toBe('TUNING E2');
  });

  it('shows a dash when there is no detected note and hides the octave', () => {
    fixture.componentInstance.note.set(null);
    fixture.componentInstance.octave.set(null);
    fixture.componentInstance.status.set('IDLE');
    fixture.detectChanges();

    expect(el('.pitch-note').textContent?.trim()).toBe('—');
    expect(el('.pitch-octave').classList.contains('visible')).toBe(false);
    expect(el('.pitch-octave').textContent).toBe('\u00a0');
    expect(el('.pitch-status').textContent?.trim()).toBe('IDLE');
  });

  it('marks the display as locked and in tune with the tune colour', () => {
    const host = fixture.componentInstance;
    host.locked.set(true);
    host.tuned.set(true);
    host.color.set('#7ecba8');
    fixture.detectChanges();

    const status = el('.pitch-status');
    expect(status.classList.contains('locked')).toBe(true);
    expect(status.classList.contains('in-tune')).toBe(true);
    expect(el('.pitch-note').classList.contains('in-tune')).toBe(true);
    expect(el('.pitch-note').getAttribute('style')).toContain('rgb(126, 203, 168)');
  });
});
