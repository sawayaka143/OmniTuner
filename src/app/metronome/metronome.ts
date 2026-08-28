import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ScalePreferences } from '../services/scale-preferences';
import { Listbox } from '../ui/listbox/listbox';
import { NumberScrubber } from '../ui/number-scrubber';
import { Toggle } from '../ui/toggle/toggle';
import { BpmDial } from './components/bpm-dial/bpm-dial';
import {
  DENOMINATORS,
  Denominator,
  METER_PRESETS,
  PATTERN_PRESETS,
  POLY_PRESETS,
  SUBDIVISIONS,
} from './models/metronome.model';
import { MetronomePreferences } from './services/metronome-preferences';
import { MetronomeAudio } from './services/metronome-audio.service';
import { SoundBank } from './utils/metronome-sounds';
import { getTempoMarking, meterModel, tapBpm } from './utils/metronome-timing';

interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-metronome',
  imports: [DecimalPipe, Listbox, BpmDial, Toggle, NumberScrubber],
  providers: [MetronomeAudio],
  templateUrl: './metronome.html',
  styleUrl: './metronome.scss',
  host: {
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class Metronome {
  private readonly prefs = inject(MetronomePreferences);
  private readonly preferences = inject(ScalePreferences);
  private readonly audio = inject(MetronomeAudio);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = this.prefs.state;
  protected readonly preferencesState = this.preferences.state;
  readonly isPlaying = this.audio.isPlaying;
  readonly currentBar = this.audio.currentBar;
  readonly transport = this.audio.transport;
  readonly audioError = this.audio.error;

  readonly bpm = computed(() => this.state().bpm);
  readonly timeSig = computed(() => this.state().timeSignature);
  readonly divisions = computed(() => this.state().divisionsPerBeat);
  readonly barPattern = computed(() => this.state().barPattern);
  readonly poly = computed(() => this.state().poly);
  readonly sounds = computed(() => this.state().sounds);
  readonly masterVol = computed(() => this.state().masterVol);
  readonly countIn = computed(() => this.state().countIn);
  readonly ramp = computed(() => this.state().ramp);
  readonly presets = this.prefs.presets;

  readonly subdivisions = SUBDIVISIONS;

  readonly denomOptions: readonly SelectOption<Denominator>[] = DENOMINATORS.map((d) => ({
    value: d,
    label: `${d}`,
  }));
  readonly meterOptions: readonly SelectOption<string>[] = METER_PRESETS.map((m) => ({
    value: `${m.numerator}/${m.denominator}`,
    label: `${m.numerator}/${m.denominator}`,
  }));
  readonly subdivOptions: readonly SelectOption<number>[] = SUBDIVISIONS.map((s) => ({
    value: s.n,
    label: s.label,
  }));
  readonly soundSelectOptions: readonly SelectOption<string>[] = SoundBank.options().map((o) => ({
    value: o.id,
    label: o.label,
  }));

  readonly denomLabel = (o: SelectOption<Denominator>): string => `${o.value}`;
  readonly trackDenom = (o: SelectOption<Denominator>): unknown => o.value;
  readonly meterLabel = (o: SelectOption<string>): string => o.label;
  readonly trackMeter = (o: SelectOption<string>): unknown => o.value;
  readonly subdivOptionLabel = (o: SelectOption<number>): string => o.label;
  readonly trackSubdiv = (o: SelectOption<number>): unknown => o.value;
  readonly subdivLabelFor = (n: number): string =>
    this.subdivisions.find((s) => s.n === n)?.label ?? `${n}`;
  readonly soundLabel = (o: SelectOption<string>): string => o.label;
  readonly trackSound = (o: SelectOption<string>): unknown => o.value;

  readonly denomValue = computed(
    () =>
      this.denomOptions.find((o) => o.value === this.timeSig().denominator) ?? this.denomOptions[1],
  );

  readonly meterValue = computed(
    () =>
      this.meterOptions.find(
        (o) => o.value === `${this.timeSig().numerator}/${this.timeSig().denominator}`,
      ) ?? this.meterOptions[2],
  );

  readonly subdivValue = computed(
    () => this.subdivOptions.find((o) => o.value === this.divisions()) ?? this.subdivOptions[0],
  );

  readonly patternPresetOptions: readonly SelectOption<string>[] = PATTERN_PRESETS.map((p) => ({
    value: p.label,
    label: p.label,
  }));
  readonly polyPresetOptions: readonly SelectOption<string>[] = POLY_PRESETS.map((p) => ({
    value: `${p[0]}:${p[1]}`,
    label: `${p[0]}:${p[1]}`,
  }));

  readonly presetOptions = computed(() =>
    this.presets().map((p) => ({ value: p.id, label: p.name })),
  );

  readonly selectedPreset = computed(() => {
    const id = this.selectedPresetId();
    if (id === null) return null;
    return this.presets().find((p) => p.id === id) ?? null;
  });

  readonly presetTriggerLabel = computed(() => this.selectedPreset()?.name ?? 'Load preset…');

  readonly barPresetValue = computed((): SelectOption<string> => {
    const label = this.barPreset();
    return (
      this.patternPresetOptions.find((o) => o.value === label) ?? {
        value: 'Custom',
        label: 'Custom',
      }
    );
  });

  readonly polyPresetValue = computed((): SelectOption<string> => {
    const label = `${this.timeSig().numerator}:${this.poly().events}`;
    return this.polyPresetOptions.find((o) => o.value === label) ?? { value: label, label };
  });

  readonly identityOption = (o: SelectOption<string>): string => o.label;
  readonly trackPatternOption = (o: SelectOption<string>): unknown => o.value;
  readonly trackPreset = (o: SelectOption<string>): unknown => o.value;

  readonly soundRoles: readonly {
    key: 'downbeat' | 'beat' | 'subdivision' | 'poly';
    label: string;
  }[] = [
    { key: 'downbeat', label: 'Downbeat' },
    { key: 'beat', label: 'Beat' },
    { key: 'subdivision', label: 'Subdivision' },
    { key: 'poly', label: 'Polyrhythm' },
  ];

  readonly soundOptionFor = (
    key: 'downbeat' | 'beat' | 'subdivision' | 'poly',
  ): SelectOption<string> => {
    const id = this.sounds()[key].id;
    return this.soundSelectOptions.find((o) => o.value === id) ?? this.soundSelectOptions[0];
  };

  soundOpenFor(key: string): ReturnType<typeof signal<boolean>> {
    if (key === 'downbeat') return this.soundDownbeatOpen;
    if (key === 'beat') return this.soundBeatOpen;
    if (key === 'subdivision') return this.soundSubdivOpen;
    return this.soundPolyOpen;
  }

  toggleSoundOpen(key: string): void {
    if (key === 'downbeat') this.soundDownbeatOpen.update((v) => !v);
    else if (key === 'beat') this.soundBeatOpen.update((v) => !v);
    else if (key === 'subdivision') this.soundSubdivOpen.update((v) => !v);
    else this.soundPolyOpen.update((v) => !v);
  }

  readonly meterModel = computed(() =>
    meterModel(this.timeSig().numerator, this.timeSig().denominator),
  );

  readonly tempoMarking = computed(() => getTempoMarking(this.bpm()));

  readonly denomOpen = signal(false);
  readonly meterPresetOpen = signal(false);
  readonly subdivOpen = signal(false);
  readonly barPresetOpen = signal(false);
  readonly polyPresetOpen = signal(false);
  readonly soundDownbeatOpen = signal(false);
  readonly soundBeatOpen = signal(false);
  readonly soundSubdivOpen = signal(false);
  readonly soundPolyOpen = signal(false);
  readonly presetListOpen = signal(false);
  readonly presetName = signal('');
  readonly selectedPresetId = signal<string | null>(null);

  private tapTimes: number[] = [];

  private barPresetLabel = computed(() => {
    const pat = this.barPattern();
    for (const preset of PATTERN_PRESETS) {
      if (preset.bars.length === pat.length && preset.bars.every((v, i) => v === pat[i]))
        return preset.label;
    }
    return 'Custom';
  });
  readonly barPreset = this.barPresetLabel;

  readonly beatCells = computed(() =>
    Array.from({ length: this.meterModel().beatsPerBar }, (_, i) => i),
  );
  readonly polyAArray = computed(() =>
    Array.from({ length: this.meterModel().beatsPerBar }, (_, i) => i),
  );
  readonly polyBArray = computed(() => Array.from({ length: this.poly().events }, (_, i) => i));

  readonly activeBeat = computed(() => {
    const t = this.transport();
    if (!t) return -1;
    return Math.min(Math.floor(t.progress * t.beatsPerBar), t.beatsPerBar - 1);
  });

  constructor() {
    this.audio.configure(this.state());
    effect(() => {
      const state = this.state();
      untracked(() => this.audio.configure(state));
    });
    this.destroyRef.onDestroy(() => this.audio.stop());
  }

  togglePlay(): void {
    void this.audio.toggle();
  }

  nudgeBpm(delta: number): void {
    this.prefs.setBpm(this.bpm() + delta);
  }

  setBpm(value: number): void {
    if (!Number.isFinite(value)) return;
    this.prefs.setBpm(Math.round(value));
  }

  onTap(): void {
    const now = performance.now();
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000)
      this.tapTimes = [];
    this.tapTimes.push(now);
    if (this.tapTimes.length > 6) this.tapTimes.shift();
    if (this.tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.tapTimes.length; i++)
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      const bpm = tapBpm(intervals);
      if (bpm !== null) this.prefs.setBpm(bpm);
    }
    window.setTimeout(() => {
      if (performance.now() - (this.tapTimes[this.tapTimes.length - 1] ?? 0) > 2000)
        this.tapTimes = [];
    }, 2100);
  }

  setTimeSigNumerator(value: number): void {
    const num = Math.max(1, Math.min(32, Math.round(value)));
    this.prefs.setTimeSignature(num, this.timeSig().denominator);
  }

  setDenom(option: SelectOption<Denominator>): void {
    this.prefs.setTimeSignature(this.timeSig().numerator, option.value);
    this.denomOpen.set(false);
  }

  applyMeterPreset(option: SelectOption<string>): void {
    const [num, den] = option.value.split('/').map(Number) as [number, Denominator];
    this.prefs.setTimeSignature(num, den);
    this.meterPresetOpen.set(false);
  }

  setDivisions(option: SelectOption<number>): void {
    this.prefs.setDivisionsPerBeat(option.value);
    this.subdivOpen.set(false);
  }

  applyBarPreset(bars: readonly number[]): void {
    this.prefs.setBarPattern(bars);
  }

  applyBarPresetOption(option: SelectOption<string>): void {
    const preset = PATTERN_PRESETS.find((p) => p.label === option.value);
    if (preset) this.applyBarPreset(preset.bars);
    this.barPresetOpen.set(false);
  }

  setCustomBarLength(length: number): void {
    const current = this.barPattern();
    const next = Math.max(1, Math.min(16, Math.round(length)));
    if (next === current.length) return;
    let updated: number[];
    if (next > current.length) updated = [...current, ...Array(next - current.length).fill(1)];
    else updated = current.slice(0, next);
    this.prefs.setBarPattern(updated);
  }

  toggleBarIndex(index: number): void {
    const current = [...this.barPattern()];
    current[index] = current[index] ? 0 : 1;
    if (current.every((v) => v === 0)) (current as number[])[index] = 1;
    this.prefs.setBarPattern(current);
  }

  setPolyEnabled(enabled: boolean): void {
    this.prefs.setPoly({ enabled });
  }

  setPolyEvents(value: number): void {
    this.prefs.setPoly({ events: Math.round(value) });
  }

  setCountIn(enabled: boolean): void {
    this.prefs.setCountIn(enabled);
  }

  setRampEnabled(enabled: boolean): void {
    this.prefs.setRamp({ enabled });
  }

  setRampTarget(bpm: number): void {
    this.prefs.setRamp({ targetBpm: Math.round(bpm) });
  }

  setRampBars(bars: number): void {
    this.prefs.setRamp({ bars: Math.round(bars) });
  }

  onPresetNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.presetName.set(target.value);
  }

  savePreset(): void {
    const preset = this.prefs.savePreset(this.presetName());
    if (!preset) return;
    this.selectedPresetId.set(preset.id);
    this.presetName.set('');
    this.presetListOpen.set(false);
  }

  applyPresetOption(option: SelectOption<string>): void {
    this.prefs.applyPreset(option.value);
    this.selectedPresetId.set(option.value);
    this.presetListOpen.set(false);
  }

  deleteSelectedPreset(): void {
    const id = this.selectedPresetId();
    if (id === null) return;
    this.prefs.deletePreset(id);
    this.selectedPresetId.set(null);
  }

  applyPolyPreset(pair: readonly [number, number]): void {
    const [a, b] = pair;
    let den: Denominator = this.timeSig().denominator;
    if (a % 3 === 0 && a >= 6 && den >= 8) den = 4;
    this.prefs.setTimeSignature(a, den);
    this.prefs.setPoly({ enabled: true, events: b });
  }

  applyPolyPresetOption(option: SelectOption<string>): void {
    const [a, b] = option.value.split(':').map(Number) as [number, number];
    this.applyPolyPreset([a, b]);
    this.polyPresetOpen.set(false);
  }

  setSoundRole(
    role: 'downbeat' | 'beat' | 'subdivision' | 'poly',
    option: SelectOption<string>,
  ): void {
    this.prefs.setSoundRole(role, option.value);
    if (role === 'downbeat') this.soundDownbeatOpen.set(false);
    if (role === 'beat') this.soundBeatOpen.set(false);
    if (role === 'subdivision') this.soundSubdivOpen.set(false);
    if (role === 'poly') this.soundPolyOpen.set(false);
  }

  setMasterVol(value: number): void {
    this.prefs.setMasterVol(value);
  }

  setRoleVol(role: 'downbeat' | 'beat' | 'subdivision' | 'poly', value: number): void {
    const current = this.sounds()[role];
    this.prefs.setSoundRole(role, current.id, value / 100);
  }

  previewMain(): void {
    this.audio.previewMain();
  }

  previewPoly(): void {
    this.audio.previewPoly();
  }

  clearAudioError(): void {
    this.audio.clearError();
  }

  protected onWindowKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isField =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (event.code === 'Space' || event.key === ' ') {
      if (isField) return;
      event.preventDefault();
      void this.audio.toggle();
      return;
    }
    if ((event.key === 't' || event.key === 'T') && !isField) {
      event.preventDefault();
      this.onTap();
      return;
    }
    if (!isField && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.nudgeBpm(event.key === 'ArrowUp' ? (event.shiftKey ? 5 : 1) : event.shiftKey ? -5 : -1);
    }
  }
}
