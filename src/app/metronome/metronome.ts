import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PressRepeat } from '../ui/press-repeat';
import { Listbox } from '../ui/listbox/listbox';
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
import { describeMeter, meterModel, tapBpm } from './utils/metronome-timing';

interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-metronome',
  imports: [PressRepeat, DecimalPipe, Listbox, BpmDial],
  providers: [MetronomeAudio],
  templateUrl: './metronome.html',
  styleUrl: './metronome.scss',
  host: {
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class Metronome {
  private readonly prefs = inject(MetronomePreferences);
  private readonly audio = inject(MetronomeAudio);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = this.prefs.state;
  readonly isPlaying = this.audio.isPlaying;
  readonly currentBar = this.audio.currentBar;
  readonly currentTick = this.audio.currentTickInBar;
  readonly transport = this.audio.transport;
  readonly audioError = this.audio.error;
  readonly uiQueue = this.audio.getUiQueue.bind(this.audio);

  readonly bpm = computed(() => this.state().bpm);
  readonly timeSig = computed(() => this.state().timeSignature);
  readonly divisions = computed(() => this.state().divisionsPerBeat);
  readonly barPattern = computed(() => this.state().barPattern);
  readonly poly = computed(() => this.state().poly);
  readonly sounds = computed(() => this.state().sounds);
  readonly masterVol = computed(() => this.state().masterVol);

  readonly denominators = DENOMINATORS;
  readonly meterPresets = METER_PRESETS;
  readonly subdivisions = SUBDIVISIONS;
  readonly patternPresets = PATTERN_PRESETS;
  readonly polyPresets = POLY_PRESETS;
  readonly soundOptions = SoundBank.options();

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
  readonly subdivLabelFor = (n: number): string => this.subdivisions.find((s) => s.n === n)?.label ?? `${n}`;
  readonly soundLabel = (o: SelectOption<string>): string => o.label;
  readonly trackSound = (o: SelectOption<string>): unknown => o.value;

  readonly soundRoles: readonly { key: 'downbeat' | 'beat' | 'subdivision' | 'poly'; label: string }[] = [
    { key: 'downbeat', label: 'Downbeat' },
    { key: 'beat', label: 'Beat' },
    { key: 'subdivision', label: 'Subdivision' },
    { key: 'poly', label: 'Polyrhythm' },
  ];

  readonly soundOptionFor = (key: 'downbeat' | 'beat' | 'subdivision' | 'poly'): SelectOption<string> => {
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

  readonly meterModel = computed(() => meterModel(this.timeSig().numerator, this.timeSig().denominator));
  readonly meterDesc = computed(() => describeMeter(this.meterModel()));
  readonly barDurationLabel = computed(() => {
    const m = this.meterModel();
    const ms = (60 / this.bpm()) * m.barQuarters * 1000;
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
  });

  readonly showAccent = signal(false);
  readonly activeTab = signal<'pattern' | 'poly' | 'sounds'>('pattern');
  readonly denomOpen = signal(false);
  readonly meterPresetOpen = signal(false);
  readonly subdivOpen = signal(false);
  readonly soundDownbeatOpen = signal(false);
  readonly soundBeatOpen = signal(false);
  readonly soundSubdivOpen = signal(false);
  readonly soundPolyOpen = signal(false);

  private tapTimes: number[] = [];
  readonly tapCount = signal(0);

  readonly decBpm = (): void => this.nudgeBpm(-1);
  readonly incBpm = (): void => this.nudgeBpm(1);

  private barPresetLabel = computed(() => {
    const pat = this.barPattern();
    for (const preset of PATTERN_PRESETS) {
      if (preset.bars.length === pat.length && preset.bars.every((v, i) => v === pat[i])) return preset.label;
    }
    return 'Custom';
  });
  readonly barPreset = this.barPresetLabel;

  readonly ticksArray = computed(() => {
    const m = this.meterModel();
    return Array.from({ length: m.beatsPerBar * this.divisions() }, (_, i) => i);
  });
  readonly beatsArray = computed(() => Array.from({ length: this.meterModel().beatsPerBar }, (_, i) => i));
  readonly polyAArray = computed(() => Array.from({ length: this.meterModel().beatsPerBar }, (_, i) => i));
  readonly polyBArray = computed(() => Array.from({ length: this.poly().events }, (_, i) => i));

  subdivTicks = (): readonly number[] => this.ticksArray().slice(1).map((_, i) => ((i + 1) / this.divisions()) * 100);

  private resizeState: { startX: number; startW: number } | null = null;
  private onResizeMove = (event: PointerEvent): void => this.handleResizeMove(event);
  private onResizeUp = (): void => this.handleResizeEnd();

  constructor() {
    const saved = this.readControlsWidth();
    if (saved !== null) this.applyControlsWidth(saved);
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
    this.prefs.setBpm(Math.round(value));
  }

  onTap(): void {
    const now = performance.now();
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000) this.tapTimes = [];
    this.tapTimes.push(now);
    if (this.tapTimes.length > 6) this.tapTimes.shift();
    this.tapCount.set(this.tapTimes.length);
    if (this.tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.tapTimes.length; i++) intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      const bpm = tapBpm(intervals);
      if (bpm !== null) this.prefs.setBpm(bpm);
    }
    window.setTimeout(() => {
      if (performance.now() - (this.tapTimes[this.tapTimes.length - 1] ?? 0) > 2000) {
        this.tapTimes = [];
        this.tapCount.set(0);
      }
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

  applyPolyPreset(pair: readonly [number, number]): void {
    const [a, b] = pair;
    let den: Denominator = this.timeSig().denominator;
    if (a % 3 === 0 && a >= 6 && den >= 8) den = 4;
    this.prefs.setTimeSignature(a, den);
    this.prefs.setPoly({ enabled: true, events: b });
  }

  setSoundRole(role: 'downbeat' | 'beat' | 'subdivision' | 'poly', option: SelectOption<string>): void {
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

  onResizeStart(event: PointerEvent): void {
    event.preventDefault();
    const el = document.querySelector('.finder-columns');
    if (!el) return;
    const width = parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 340;
    this.resizeState = { startX: event.clientX, startW: width };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.onResizeMove);
    window.addEventListener('pointerup', this.onResizeUp);
    window.addEventListener('pointercancel', this.onResizeUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  onResizeKeydown(event: KeyboardEvent): void {
    const el = document.querySelector('.finder-columns');
    if (!el) return;
    const width = parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 340;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.applyControlsWidth(Math.max(240, width - 20));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.applyControlsWidth(Math.min(420, width + 20));
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.applyControlsWidth(240);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.applyControlsWidth(420);
    } else return;
    this.persistControlsWidth(parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 340);
  }

  private handleResizeMove(event: PointerEvent): void {
    if (!this.resizeState) return;
    const dx = event.clientX - this.resizeState.startX;
    this.applyControlsWidth(Math.min(420, Math.max(240, this.resizeState.startW + dx)));
  }

  private handleResizeEnd(): void {
    if (!this.resizeState) return;
    const el = document.querySelector('.finder-columns');
    const width = el ? parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 0 : 0;
    if (width) this.persistControlsWidth(width);
    window.removeEventListener('pointermove', this.onResizeMove);
    window.removeEventListener('pointerup', this.onResizeUp);
    window.removeEventListener('pointercancel', this.onResizeUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this.resizeState = null;
  }

  private applyControlsWidth(px: number): void {
    const el = document.querySelector('.finder-columns');
    if (el) (el as HTMLElement).style.setProperty('--controls-w', `${px}px`);
  }

  private persistControlsWidth(px: number): void {
    try {
      localStorage.setItem('omnituner.metronome.controlsWidth', String(Math.round(px)));
    } catch {}
  }

  private readControlsWidth(): number | null {
    try {
      const raw = localStorage.getItem('omnituner.metronome.controlsWidth');
      if (!raw) return null;
      const num = parseInt(raw, 10);
      return Number.isFinite(num) ? Math.min(420, Math.max(240, num)) : null;
    } catch {
      return null;
    }
  }

  protected onWindowKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isField =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
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
