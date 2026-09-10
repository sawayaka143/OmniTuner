import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { SCALES } from '../data/scale.constants';
import { INSTRUMENT_REGISTRY_STORAGE } from '../services/instrument-registry';
import { SCALE_PREFERENCES_STORAGE, ScalePreferences } from '../services/scale-preferences';
import { Scales } from './scales';

class FakeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('Scales', () => {
  let fixture: ComponentFixture<Scales>;
  let component: Scales;
  let preferences: ScalePreferences;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const heading = (): string =>
    el().querySelector('#current-scale-title')?.textContent?.trim() ?? '';
  const headerMeta = (): string =>
    el().querySelector('.current-scale p')?.textContent?.trim() ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Scales],
      providers: [
        { provide: SCALE_PREFERENCES_STORAGE, useValue: new FakeStorage() },
        { provide: INSTRUMENT_REGISTRY_STORAGE, useValue: new FakeStorage() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Scales);
    component = fixture.componentInstance;
    fixture.detectChanges();
    preferences = TestBed.inject(ScalePreferences);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('renders the selected root note and scale label', () => {
    const scale = SCALES.find((s) => s.id === preferences.state().scaleId) ?? SCALES[0];

    expect(component).toBeTruthy();
    expect(heading()).toContain(scale.label);
  });

  it('re-renders when the root note changes', () => {
    preferences.setRootPitchClass(2);
    fixture.detectChanges();

    expect(heading().startsWith('D')).toBe(true);
  });

  it('re-renders when the accidental preference flips', () => {
    preferences.setRootPitchClass(1);
    preferences.setAccidental('sharp');
    fixture.detectChanges();
    expect(heading().startsWith('C')).toBe(true);

    preferences.setAccidental('flat');
    fixture.detectChanges();
    expect(heading().startsWith('D')).toBe(true);
  });

  it('reflects the fret count in the workbench header', () => {
    preferences.setFretCount(12);
    fixture.detectChanges();

    expect(headerMeta()).toContain('12 frets');
  });

  it('renders the fretboard for the current tuning', () => {
    expect(el().querySelector('app-fretboard')).not.toBeNull();
  });

  it('shows the position readout for the current selection', () => {
    const readout = el().querySelector('.workbench-footer .readout p')?.textContent ?? '';
    expect(readout.length).toBeGreaterThan(0);
  });

  it('degrades gracefully when audio playback is unavailable', () => {
    const playScale = el().querySelector<HTMLButtonElement>('.play-scale');
    expect(playScale).toBeTruthy();

    expect(() => {
      playScale?.click();
      fixture.detectChanges();
    }).not.toThrow();

    expect(el().textContent).not.toContain('undefined');
  });

  it('has no axe violations', async () => {
    const results = await axe(el());
    expect(results).toHaveNoViolations();
  });

  describe('interactions', () => {
    interface ScalesApi {
      selectRoot(note: string): void;
      selectScale(id: string): void;
      setAccidental(value: string): void;
      setFretCount(value: number): void;
      setLabelMode(value: string): void;
      setShowOutsideScale(value: boolean): void;
      toggleRootPicker(): void;
      toggleScalePicker(): void;
      toggleInstrumentPicker(): void;
      toggleTuningPicker(): void;
      closePickers(): void;
      inspectCell(cell: unknown): void;
      playScale(): void;
      playTuning(): void;
      dismissPlaybackError(): void;
    }

    const api = (): ScalesApi => component as unknown as ScalesApi;

    it('changes the root note and closes the picker', () => {
      api().toggleRootPicker();
      expect(component.rootPickerOpen()).toBe(true);

      api().selectRoot('G');

      expect(preferences.state().rootPitchClass).toBe(7);
      expect(component.rootPickerOpen()).toBe(false);
    });

    it('ignores an unparseable root note', () => {
      const before = preferences.state().rootPitchClass;
      api().selectRoot('not-a-note');

      expect(preferences.state().rootPitchClass).toBe(before);
    });

    it('changes the scale and closes the picker', () => {
      api().toggleScalePicker();
      api().selectScale('natural-minor');

      expect(preferences.state().scaleId).toBe('natural-minor');
      expect(component.scalePickerOpen()).toBe(false);
    });

    it('keeps only one picker open at a time', () => {
      api().toggleRootPicker();
      api().toggleScalePicker();
      expect(component.rootPickerOpen()).toBe(false);
      expect(component.scalePickerOpen()).toBe(true);

      api().toggleInstrumentPicker();
      expect(component.scalePickerOpen()).toBe(false);
      expect(component.instrumentPickerOpen()).toBe(true);

      api().toggleTuningPicker();
      expect(component.instrumentPickerOpen()).toBe(false);
      expect(component.tuningPickerOpen()).toBe(true);

      api().closePickers();
      expect(component.tuningPickerOpen()).toBe(false);
    });

    it('persists display preferences', () => {
      api().setAccidental('flat');
      expect(preferences.state().accidental).toBe('flat');

      api().setFretCount(15);
      expect(preferences.state().fretCount).toBe(15);

      api().setLabelMode('scale-degrees');
      expect(preferences.state().labelMode).toBe('scale-degrees');

      api().setShowOutsideScale(true);
      expect(preferences.state().showOutsideScale).toBe(true);
    });

    it('reports the inspected position in the readout', () => {
      api().inspectCell(null);
      expect(el().textContent).toContain('notes');

      api().inspectCell({
        stringIndex: 0,
        fret: 3,
        pitchClass: 0,
        midi: 48,
        interval: { semitones: 0, label: 'R' },
        noteName: 'C',
        color: '#fff',
        isRoot: true,
      });
      fixture.detectChanges();

      expect(el().textContent).toContain('fret 3');
      expect(el().textContent).toContain('string 1');
    });

    it('does not throw when playback runs without audio support', () => {
      expect(() => {
        api().playScale();
        api().playTuning();
        api().dismissPlaybackError();
      }).not.toThrow();
    });
  });
});
