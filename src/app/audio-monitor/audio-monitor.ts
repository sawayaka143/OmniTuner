import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { InstrumentSelector } from '../components/instrument-selector/instrument-selector';
import { InstrumentManager } from '../components/instrument-manager/instrument-manager';
import { TuningEditor, TuningEditorValue } from '../components/tunings-editor/tunings-editor';
import { PitchDisplay } from '../components/pitch-display/pitch-display';
import { PitchMeter, Tick } from '../components/pitch-meter/pitch-meter';
import { StringList } from '../components/string-list/string-list';
import { Toggle } from '../ui/toggle/toggle';
import { Tuning } from '../models/instrument.model';
import {
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
  TunerMode,
} from '../models/tuner-preferences.model';
import { AudioCaptureService } from '../services/audio-capture-service';
import { HapticsService } from '../services/haptics.service';
import { InstrumentRegistry } from '../services/instrument-registry';
import { ScalePlayback } from '../services/scale-playback';
import { ThemeService } from '../services/theme.service';
import { TunerPreferences } from '../services/tuner-preferences';
import {
  centsFromMidiFloat,
  frequencyToMidiFloat,
  frequencyToMidiNote,
  hzDisplay,
  interpolateColor,
  midiNoteLabel,
  nearestSemitone,
  needlePercentFromCents,
  shouldConfirm,
  tuneCentsText,
  tuneColorProgress,
  tuneDirectionText,
  nearestStringTarget,
  StringTarget,
} from '../utils/pitch-utils';

const LOCK_PULSE_DURATION_MS = 900;

const LIGHT_TUNE_INK = '#1a1a18';

const RELEASE_HYSTERESIS_MS = 135;

@Component({
  selector: 'app-audio-monitor',
  imports: [
    TuningEditor,
    InstrumentSelector,
    InstrumentManager,
    PitchMeter,
    PitchDisplay,
    StringList,
    Toggle,
  ],
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
  host: {
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class AudioMonitor implements OnInit {
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly registry = inject(InstrumentRegistry);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly scalePlayback = inject(ScalePlayback);
  private readonly haptics = inject(HapticsService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isCapturing = this.audioCapture.isCapturing;
  readonly frequency = this.audioCapture.frequency;
  readonly trackingState = this.audioCapture.trackingState;
  readonly captureError = this.audioCapture.captureError;

  readonly instruments = this.registry.instruments;
  readonly selectedInstrumentId = this.registry.selectedInstrumentId;
  readonly selectedTuningId = this.registry.selectedTuningId;

  readonly dropdownOpen = signal(false);
  readonly plusActive = signal(false);
  readonly tuningEditorOpen = signal(false);
  readonly instrumentManagerOpen = signal(false);
  readonly instrumentManagerCreateMode = signal(false);
  readonly editingTuningId = signal<string | null>(null);
  readonly editorInitialName = signal('');
  readonly editorInitialNotes = signal<readonly number[]>([]);

  readonly mode = signal<TunerMode>(this.initialMode());
  readonly manualIndex = signal(0);
  readonly autoTuned = signal<readonly string[]>([]);
  readonly confirmed = signal(false);
  readonly pulseActive = signal(false);

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdStartedAt = 0;
  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;

  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly lastAutoTargetName = signal<string | null>(null);

  readonly ticks: Tick[] = [];

  readonly selectedInstrumentIndex = computed(() =>
    this.instruments().findIndex((instrument) => instrument.id === this.selectedInstrumentId()),
  );

  private readonly currentInstrument = this.registry.selectedInstrument;

  readonly currentInstrumentLabel = computed(() => this.currentInstrument().label);

  readonly availableTunings = this.registry.availableTunings;

  readonly currentTuning = this.registry.selectedTuning;

  readonly currentStrings = computed(() => this.currentTuning().strings);

  readonly tuningSummary = computed(() =>
    this.currentStrings()
      .map((string) => string.name)
      .join(' '),
  );

  protected readonly minTunerMidiNote = MIN_TUNER_MIDI_NOTE;
  protected readonly maxTunerMidiNote = MAX_TUNER_MIDI_NOTE;
  protected readonly maxCustomTuningNameLength = MAX_CUSTOM_TUNING_NAME_LENGTH;

  readonly editorPresets = computed(() =>
    this.currentInstrument().tunings.map((tuning) => ({
      id: tuning.id,
      name: tuning.label,
      notes: tuning.strings.map((string) => frequencyToMidiNote(string.freq) ?? 69),
    })),
  );

  readonly referenceNotes = computed(() => this.editorPresets()[0]?.notes ?? null);

  readonly autoTarget = computed<StringTarget | null>(() => {
    if (!this.isCapturing()) return null;
    const freq = this.frequency();
    if (!freq || freq <= 0) return null;
    const played = frequencyToMidiFloat(freq, this.refPitch());
    if (played === null) return null;
    return nearestStringTarget(
      played,
      this.currentStrings(),
      this.lastAutoTargetName() ?? undefined,
    );
  });

  readonly autoTunedNames = computed(() => (this.mode() === 'auto' ? this.autoTuned() : []));

  readonly currentHz = computed(() => hzDisplay(this.frequency()));

  readonly isLocked = computed(() => this.trackingState() === 'locked');

  readonly manualTarget = computed(() => {
    const strings = this.currentStrings();
    if (strings.length === 0) return null;
    return strings[Math.min(this.manualIndex(), strings.length - 1)];
  });

  readonly manualTargetInfo = computed<{ noteName: string; octave: number } | null>(() => {
    const target = this.manualTarget();
    if (!target) return null;

    const nominalMidi = frequencyToMidiNote(target.freq);
    if (nominalMidi === null) return null;
    const label = midiNoteLabel(nominalMidi);
    return {
      noteName: label.slice(0, -1),
      octave: Number(label.slice(-1)),
    };
  });

  readonly frameCents = computed<number | null>(() => {
    if (this.mode() === 'auto') return this.autoTarget()?.cents ?? null;

    const freq = this.frequency();
    if (freq === null || freq <= 0) return null;
    const target = this.manualTarget();
    if (!target) return null;
    return centsFromMidiFloat(frequencyToMidiFloat(freq, this.refPitch()), this.targetMidi(target));
  });

  readonly inRange = computed(
    () => this.frameCents() !== null && Math.abs(this.frameCents()!) <= this.tolerance(),
  );

  readonly showTuned = computed(() => this.tunerSettings().inTune.enabled && this.confirmed());

  readonly isTuned = computed(() => {
    if (this.tunerSettings().inTune.enabled) return this.showTuned();
    const cents = this.frameCents();
    return (
      cents !== null && this.trackingState() === 'locked' && Math.abs(cents) <= this.tolerance()
    );
  });

  readonly needleLeft = computed(() => needlePercentFromCents(this.frameCents()));

  readonly tunePrompt = computed(() => {
    return tuneDirectionText(this.frameCents(), this.tolerance());
  });

  readonly tuneCents = computed(() => tuneCentsText(this.frameCents(), this.tolerance()));

  readonly tuneColorHex = computed(() => {
    const cents = this.frameCents();
    if (cents === null || Math.abs(cents) <= this.tolerance()) return null;
    const settings = this.tunerSettings().inTune;
    const blended = interpolateColor(
      settings.outOfTuneColor,
      settings.color,
      tuneColorProgress(cents, this.tolerance()),
    );
    if (blended && this.themeService.theme() === 'light') {
      return interpolateColor(blended, LIGHT_TUNE_INK, 0.3) ?? blended;
    }
    return blended;
  });

  readonly chipTuned = computed(() => this.isTuned() && this.activeString() !== null);

  readonly activeString = computed(() => {
    if (this.mode() === 'manual') return this.manualTarget()?.name ?? null;
    return this.autoTarget()?.name ?? null;
  });

  private readonly playedNoteLabel = computed(() => {
    const freq = this.frequency();
    if (freq === null || freq <= 0 || !Number.isFinite(freq)) return null;
    const played = frequencyToMidiFloat(freq, this.refPitch());
    const nearest = nearestSemitone(played);
    return nearest ? midiNoteLabel(nearest.midi) : null;
  });

  readonly targetNoteLabel = computed(() => {
    if (this.mode() === 'manual') {
      const cents = this.frameCents();
      if (cents !== null && Math.abs(cents) < 50) {
        const target = this.manualTargetInfo();
        if (target) return `${target.noteName}${target.octave}`;
      }
      return this.playedNoteLabel();
    }

    const target = this.autoTarget();
    if (!target) return this.playedNoteLabel();

    const cents = this.frameCents();
    if (cents !== null && Math.abs(cents) < 50) {
      return midiNoteLabel(target.midi);
    }
    return this.playedNoteLabel();
  });

  readonly displayNoteName = computed(() => {
    const label = this.targetNoteLabel();
    return label ? label.slice(0, -1) : null;
  });

  readonly displayOctave = computed(() => {
    const label = this.targetNoteLabel();
    return label ? Number(label.slice(-1)) : null;
  });

  readonly statusMessage = computed(() => {
    const error = this.captureError();
    if (error) return error;
    if (!this.isCapturing()) return 'IDLE';
    if (this.showTuned()) return 'IN TUNE';
    if (this.isLocked()) {
      const target = this.mode() === 'manual' ? this.manualTarget() : this.autoTarget();
      return target ? `TUNING ${target.name}` : 'LISTENING FOR A NOTE';
    }
    return 'LISTENING FOR A NOTE';
  });

  constructor() {
    effect(() => {
      this.mode();
      this.selectedTuningId();
      this.selectedInstrumentId();
      untracked(() => {
        this.autoTuned.set([]);
        this.confirmed.set(false);
        this.clearReleaseTimer();
        this.lastAutoTargetName.set(null);
        this.clearHoldTimer();
      });
    });

    effect(() => {
      const target = this.autoTarget();
      if (
        target &&
        this.trackingState() === 'locked' &&
        target.name !== this.lastAutoTargetName()
      ) {
        this.lastAutoTargetName.set(target.name);
      }
    });

    effect(() => {
      if (this.trackingState() !== 'locked') {
        this.clearHoldTimer();
        if (this.trackingState() === 'idle') {
          this.clearReleaseTimer();
          this.confirmed.set(false);
        } else if (this.confirmed() && this.releaseTimer === null) {
          this.scheduleReleaseTimer();
        }
        return;
      }

      const inRange = this.inRange();
      if (this.confirmed()) {
        if (inRange) this.clearReleaseTimer();
        else if (this.releaseTimer === null) this.scheduleReleaseTimer();
        return;
      }

      this.clearReleaseTimer();

      if (!inRange) {
        const frameCents = this.frameCents();
        const holding = this.holdTimer !== null;
        const withinHysteresis =
          holding && frameCents !== null && Math.abs(frameCents) <= this.tolerance() + 1.5;

        if (!withinHysteresis) {
          this.clearHoldTimer();
          return;
        }
      }

      const now = performance.now();
      const elapsed = this.holdTimer !== null ? now - this.holdStartedAt : 0;
      const holdMs = this.tunerSettings().inTune.holdMs;
      if (shouldConfirm({ inRange, elapsedMs: elapsed, holdMs })) {
        this.confirmLock();
        return;
      }

      if (this.holdTimer === null) this.holdStartedAt = now;
      this.scheduleHoldTimer(holdMs - elapsed);
    });
  }

  ngOnInit(): void {
    const totalTicks = 41;
    for (let i = 0; i < totalTicks; i++) {
      const leftPos = `${(i / (totalTicks - 1)) * 100}%`;
      let type: 'normal' | 'major' | 'center' = 'normal';
      if (i === 20) type = 'center';
      else if (i % 5 === 0) type = 'major';
      this.ticks.push({ leftPos, type });
    }

    this.destroyRef.onDestroy(() => {
      this.clearReleaseTimer();
      this.clearHoldTimer();
      if (this.pulseTimeout !== null) {
        clearTimeout(this.pulseTimeout);
        this.pulseTimeout = null;
      }
    });

    if (this.tunerSettings().autoStart) {
      this.audioCapture.attemptAutoStart();
    }
  }

  protected selectMode(mode: TunerMode): void {
    if (this.mode() === mode) return;

    if (mode === 'manual') {
      const targetName = this.autoTarget()?.name;
      if (targetName) {
        const index = this.currentStrings().findIndex((string) => string.name === targetName);
        if (index !== -1) this.manualIndex.set(index);
      }
    }

    this.mode.set(mode);
    this.tunerPreferences.setMode(mode);
  }

  protected selectString(index: number): void {
    this.manualIndex.set(index);
    this.mode.set('manual');
    this.tunerPreferences.setMode('manual');

    const string = this.currentStrings()[index];
    if (string) {
      this.scalePlayback.playSampleNote(frequencyToMidiNote(string.freq) ?? 69);
    }
  }

  protected selectInstrument(instrumentId: string): void {
    if (this.selectedInstrumentId() === instrumentId) return;

    this.registry.selectInstrument(instrumentId);
    this.dropdownOpen.set(false);
  }

  protected selectTuning(tuningId: string): void {
    this.registry.selectTuning(tuningId);
    this.dropdownOpen.set(false);
  }

  protected openCreateTuning(): void {
    this.editingTuningId.set(null);
    this.editorInitialName.set('');
    this.editorInitialNotes.set(this.notesForTuning(this.currentTuning()));
    this.dropdownOpen.set(false);
    this.tuningEditorOpen.set(true);
  }

  protected openEditTuning(tuningId: string): void {
    const tuning = this.registry
      .customTunings()
      .find(
        (candidate) =>
          candidate.id === tuningId && candidate.instrumentId === this.selectedInstrumentId(),
      );
    if (!tuning) return;

    this.editingTuningId.set(tuning.id);
    this.editorInitialName.set(tuning.name);
    this.editorInitialNotes.set([...tuning.notes]);
    this.dropdownOpen.set(false);
    this.tuningEditorOpen.set(true);
  }

  protected deleteCustomTuning(tuningId: string): void {
    this.registry.deleteTuning(tuningId);
  }

  protected saveCustomTuning(value: TuningEditorValue): void {
    const editingId = this.editingTuningId();
    const tuning = editingId
      ? this.registry.updateTuning(editingId, value.name, value.notes)
      : this.registry.createTuning(this.selectedInstrumentId(), value.name, value.notes);

    this.registry.selectTuning(tuning.id);
    this.dismissTuningEditor();
  }

  protected dismissTuningEditor(): void {
    this.tuningEditorOpen.set(false);
    this.editingTuningId.set(null);
  }

  protected toggleDropdown(): void {
    this.dropdownOpen.update((open) => !open);
  }

  protected closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  protected openInstrumentManager(): void {
    this.closeDropdown();
    this.instrumentManagerCreateMode.set(false);
    this.instrumentManagerOpen.set(true);
  }

  protected openCreateInstrument(): void {
    this.closeDropdown();
    this.plusActive.set(true);
    this.instrumentManagerCreateMode.set(true);
    this.instrumentManagerOpen.set(true);
  }

  protected dismissInstrumentManager(): void {
    this.plusActive.set(false);
    this.instrumentManagerCreateMode.set(false);
    this.instrumentManagerOpen.set(false);
  }

  protected toggleCapture(): void {
    this.haptics.light();
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    } else {
      void this.audioCapture.startCapture();
    }
  }

  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.code !== 'Space' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    )
      return;
    event.preventDefault();
    this.toggleCapture();
  }

  private notesForTuning(tuning: Tuning): readonly number[] {
    return tuning.strings.map((string) => frequencyToMidiNote(string.freq) ?? 69);
  }

  private readonly tunerSettings = this.tunerPreferences.tunerSettings;

  private readonly refPitch = computed(() => this.tunerSettings().referencePitch);

  private readonly tolerance = computed(() => this.tunerSettings().inTune.tolerance);

  private initialMode(): TunerMode {
    const settings = this.tunerPreferences.tunerSettings();
    return settings.startupMode === 'remember' ? settings.mode : settings.startupMode;
  }

  private targetMidi(target: { readonly freq: number }): number {
    return frequencyToMidiNote(target.freq) ?? 69;
  }

  private confirmLock(): void {
    this.clearHoldTimer();
    this.clearReleaseTimer();
    if (this.confirmed()) return;

    this.confirmed.set(true);
    this.haptics.success();
    const inTune = this.tunerSettings().inTune;
    if (inTune.enabled && inTune.sound) this.scalePlayback.playChime();
    if (inTune.enabled && inTune.glow) this.triggerPulse();

    if (this.mode() === 'auto') {
      const target = this.autoTarget();
      if (target) {
        this.autoTuned.update((names) =>
          names.includes(target.name) ? names : [...names, target.name],
        );
      }
    }
  }

  private scheduleHoldTimer(ms: number): void {
    this.clearHoldTimer();
    this.holdTimer = setTimeout(
      () => {
        this.holdTimer = null;
        if (this.inRange()) this.confirmLock();
      },
      Math.max(0, ms),
    );
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private scheduleReleaseTimer(): void {
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.confirmed() && !this.inRange()) this.confirmed.set(false);
    }, RELEASE_HYSTERESIS_MS);
  }

  private clearReleaseTimer(): void {
    if (this.releaseTimer !== null) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  private triggerPulse(): void {
    this.pulseActive.set(true);
    if (this.pulseTimeout !== null) clearTimeout(this.pulseTimeout);
    this.pulseTimeout = setTimeout(() => this.pulseActive.set(false), LOCK_PULSE_DURATION_MS);
  }
}
