import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { Metronome } from './metronome';
import { BPM_DEFAULT } from './models/metronome.model';
import { METRONOME_STORAGE, MetronomePreferences } from './services/metronome-preferences';

class FakeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('Metronome', () => {
  let fixture: ComponentFixture<Metronome>;
  let component: Metronome;
  let prefs: MetronomePreferences;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const create = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [Metronome],
      providers: [{ provide: METRONOME_STORAGE, useValue: new FakeStorage() }],
    }).compileComponents();
    fixture = TestBed.createComponent(Metronome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await create();
    prefs = TestBed.inject(MetronomePreferences);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('starts from the default tempo and meter', () => {
    expect(component.bpm()).toBe(BPM_DEFAULT);
    expect(component.timeSig()).toEqual({ numerator: 4, denominator: 4 });
  });

  it('sets and nudges the tempo within bounds', () => {
    component.setBpm(142);
    expect(component.bpm()).toBe(142);

    component.nudgeBpm(5);
    expect(component.bpm()).toBe(147);

    component.setBpm(Number.NaN);
    expect(component.bpm()).toBe(147);
  });

  it('derives the tempo from tap intervals', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(0);
    component.onTap();
    now.mockReturnValue(500);
    component.onTap();

    expect(component.bpm()).toBe(120);
  });

  it('changes the meter and subdivision', () => {
    component.setTimeSigNumerator(6);
    expect(component.timeSig().numerator).toBe(6);

    component.setDenom({ value: 8, label: '8' });
    expect(component.timeSig()).toEqual({ numerator: 6, denominator: 8 });

    component.setDivisions({ value: 3, label: 'Triplets' });
    expect(component.divisions()).toBe(3);
  });

  it('applies a meter preset', () => {
    component.applyMeterPreset({ value: '7/8', label: '7/8' });

    expect(component.timeSig()).toEqual({ numerator: 7, denominator: 8 });
    expect(component.meterModel().beatsPerBar).toBeGreaterThan(0);
  });

  it('grows and shrinks the bar pattern without dropping below one bar', () => {
    component.setCustomBarLength(4);
    expect(component.barPattern().length).toBe(4);

    component.setCustomBarLength(2);
    expect(component.barPattern().length).toBe(2);

    component.setCustomBarLength(0);
    expect(component.barPattern().length).toBe(1);
  });

  it('toggles a bar on and off but never silences the whole pattern', () => {
    component.setCustomBarLength(2);
    component.toggleBarIndex(0);
    expect(component.barPattern()).toEqual([0, 1]);

    component.toggleBarIndex(1);
    expect(component.barPattern()).toEqual([0, 1]);
  });

  it('applies bar-pattern and polyrhythm presets', () => {
    component.applyBarPreset([1, 0, 1]);
    expect(component.barPattern()).toEqual([1, 0, 1]);

    component.applyPolyPreset([6, 4]);
    expect(component.poly().enabled).toBe(true);
    expect(component.poly().events).toBe(4);
  });

  it('saves, applies and deletes presets', () => {
    component.setBpm(150);
    const nameInput = document.createElement('input');
    nameInput.value = 'Warmup';
    component.onPresetNameInput({ target: nameInput } as unknown as Event);
    component.savePreset();

    expect(component.presets().length).toBe(1);
    const preset = component.presets()[0];
    expect(preset.name).toBe('Warmup');

    component.setBpm(90);
    component.applyPresetOption({ value: preset.id, label: preset.name });
    expect(component.bpm()).toBe(150);

    component.deleteSelectedPreset();
    expect(component.presets().length).toBe(0);
  });

  it('persists preference changes through the preferences service', () => {
    component.setBpm(133);
    expect(prefs.state().bpm).toBe(133);

    component.setCountIn(true);
    component.setRampEnabled(true);
    component.setRampTarget(180);
    component.setRampBars(8);

    expect(prefs.state().countIn).toBe(true);
    expect(prefs.state().ramp).toEqual({ enabled: true, targetBpm: 180, bars: 8 });
  });

  it('updates sound roles, master volume and per-role volume', () => {
    component.setMasterVol(0.5);
    expect(component.masterVol()).toBe(0.5);

    const option = component.soundSelectOptions[0];
    component.setSoundRole('beat', option);
    expect(component.sounds().beat.id).toBe(option.value);

    component.setRoleVol('beat', 40);
    expect(component.sounds().beat.vol).toBeCloseTo(0.4, 5);
  });

  it('surfaces an error instead of crashing when audio is unavailable', async () => {
    component.togglePlay();
    await fixture.whenStable();

    expect(component.audioError()).toContain('unavailable');
    component.clearAudioError();
    expect(component.audioError()).toBeNull();
  });

  it('nudges the tempo from the keyboard and ignores keys while typing', () => {
    const start = component.bpm();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.bpm()).toBe(start + 1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
    expect(component.bpm()).toBe(start + 6);

    const input = document.createElement('input');
    el().appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(component.bpm()).toBe(start + 6);
  });

  it('renders the transport controls', () => {
    expect(el().querySelector('app-bpm-dial')).not.toBeNull();
    expect(el().textContent).toContain('4/4');
  });

  describe('control menus', () => {
    interface MenuApi {
      toggleDenom(): void;
      toggleMeterPreset(): void;
      toggleSubdiv(): void;
      toggleBarPreset(): void;
      togglePolyPreset(): void;
      togglePresetList(): void;
      closeAllListboxes(): void;
      toggleSoundOpen(key: string): void;
      soundOpenFor(key: string): () => boolean;
    }

    const api = (): MenuApi => component as unknown as MenuApi;

    it('opens one menu at a time', () => {
      api().toggleDenom();
      expect(component.denomOpen()).toBe(true);

      api().toggleMeterPreset();
      expect(component.denomOpen()).toBe(false);
      expect(component.meterPresetOpen()).toBe(true);
    });

    it('closes an open menu when its trigger is used again', () => {
      api().toggleSubdiv();
      expect(component.subdivOpen()).toBe(true);

      api().toggleSubdiv();
      expect(component.subdivOpen()).toBe(false);
    });

    it('toggles the bar-pattern, polyrhythm and preset menus', () => {
      api().toggleBarPreset();
      expect(component.barPresetOpen()).toBe(true);

      api().togglePolyPreset();
      expect(component.barPresetOpen()).toBe(false);
      expect(component.polyPresetOpen()).toBe(true);

      api().togglePresetList();
      expect(component.polyPresetOpen()).toBe(false);
      expect(component.presetListOpen()).toBe(true);
    });

    it('closes every menu at once', () => {
      api().toggleDenom();
      api().togglePresetList();
      api().closeAllListboxes();

      expect(component.denomOpen()).toBe(false);
      expect(component.presetListOpen()).toBe(false);
    });

    it('routes sound menus by role', () => {
      for (const key of ['downbeat', 'beat', 'subdivision', 'poly']) {
        api().toggleSoundOpen(key);
        expect(api().soundOpenFor(key)()).toBe(true);
        api().closeAllListboxes();
        expect(api().soundOpenFor(key)()).toBe(false);
      }
    });

    it('closes the menu belonging to a chosen option', () => {
      api().toggleDenom();
      component.setDenom({ value: 8, label: '8' });
      expect(component.denomOpen()).toBe(false);

      api().toggleMeterPreset();
      component.applyMeterPreset({ value: '3/4', label: '3/4' });
      expect(component.meterPresetOpen()).toBe(false);

      api().toggleSubdiv();
      component.setDivisions({ value: 2, label: 'Eighths' });
      expect(component.subdivOpen()).toBe(false);
    });
  });

  it('previews sounds without throwing when audio is unavailable', () => {
    expect(() => {
      component.previewMain();
      component.previewPoly();
    }).not.toThrow();
  });

  it('has no axe violations', async () => {
    const results = await axe(el());
    expect(results).toHaveNoViolations();
  });
});
