import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  isDevMode,
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
import { Tuning } from '../models/instrument.model';
import {
  MAX_CUSTOM_TUNING_NAME_LENGTH,
  MAX_TUNER_MIDI_NOTE,
  MIN_TUNER_MIDI_NOTE,
  TunerMode,
} from '../models/tuner-preferences.model';
import { AudioCaptureService } from '../services/audio-capture-service';
import { InstrumentRegistry } from '../services/instrument-registry';
import { ScalePlayback } from '../services/scale-playback';
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

/** How long the one-shot lock pulse stays visible. */
const LOCK_PULSE_DURATION_MS = 900;

@Component({
  selector: 'app-audio-monitor',
  imports: [
    TuningEditor,
    InstrumentSelector,
    InstrumentManager,
    PitchMeter,
    PitchDisplay,
    StringList,
  ],
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
})
export class AudioMonitor implements OnInit {
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly registry = inject(InstrumentRegistry);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly scalePlayback = inject(ScalePlayback);
  private readonly destroyRef = inject(DestroyRef);

  readonly isCapturing = this.audioCapture.isCapturing;
  readonly frequency = this.audioCapture.frequency;
  readonly trackingState = this.audioCapture.trackingState;
  readonly captureError = this.audioCapture.captureError;
  readonly inputLevel = this.audioCapture.inputLevel; // [debug]
  readonly debugInfo = this.audioCapture.debugInfo; // [debug]
  readonly showDebug = isDevMode();

  // Instrument/tuning selection lives in the shared registry.
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

  // Session-only mode state: persisted `mode` is restored only when
  // startupMode is 'remember'; manualIndex is always re-derived per session.
  readonly mode = signal<TunerMode>(this.initialMode());
  readonly manualIndex = signal(0);
  readonly autoTuned = signal<readonly string[]>([]);   // confirmed string names, in order
  readonly confirmed = signal(false);
  readonly pulseActive = signal(false);

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private holdStartedAt = 0;
  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly ticks: Tick[] = [];

  readonly selectedInstrumentIndex = computed(() =>
    this.instruments().findIndex((instrument) => instrument.id === this.selectedInstrumentId()),
  );

  private readonly currentInstrument = this.registry.selectedInstrument;

  readonly currentInstrumentLabel = computed(() => this.currentInstrument().label);

  readonly availableTunings = this.registry.availableTunings;

  readonly currentTuning = this.registry.selectedTuning;

  readonly currentStrings = computed(() => this.currentTuning().strings);

  protected readonly minTunerMidiNote = MIN_TUNER_MIDI_NOTE;
  protected readonly maxTunerMidiNote = MAX_TUNER_MIDI_NOTE;
  protected readonly maxCustomTuningNameLength = MAX_CUSTOM_TUNING_NAME_LENGTH;

  // Built-in tunings for the current instrument become the "Start from" presets.
  // Notes are recovered at A4=440 — the reference the tuning data is defined
  // at — so a user ref-pitch change can't silently transpose a preset on save.
  readonly editorPresets = computed(() =>
    this.currentInstrument().tunings.map((tuning) => ({
      id: tuning.id,
      name: tuning.label,
      notes: tuning.strings.map((string) => frequencyToMidiNote(string.freq) ?? 69),
    })),
  );

  // Highlight strings that differ from the instrument's default tuning.
  readonly referenceNotes = computed(() => this.editorPresets()[0]?.notes ?? null);

  readonly autoTarget = computed<StringTarget | null>(() => {
    if (this.trackingState() !== 'locked' || !this.isCapturing()) return null;
    const freq = this.frequency();
    if (!freq || freq <= 0) return null;
    const played = frequencyToMidiFloat(freq, this.refPitch());
    if (played === null) return null;
    return nearestStringTarget(played, this.currentStrings());
  });

  readonly autoTunedNames = computed(() => (this.mode() === 'auto' ? this.autoTuned() : []));

  readonly currentHz = computed(() => hzDisplay(this.frequency()));

  readonly debugCents = computed(() => {
    const cents = this.frameCents();
    return cents === null ? '\u2014' : `${Math.round(cents)}\u00a2`;
  });

  readonly isLocked = computed(() => this.trackingState() === 'locked');

  /** Target string in manual mode; falls back to the lowest string if the
   *  session index is out of bounds for the current tuning. */
  readonly manualTarget = computed(() => {
    const strings = this.currentStrings();
    if (strings.length === 0) return null;
    return strings[Math.min(this.manualIndex(), strings.length - 1)];
  });

  /** The manual-mode target rendered with the app's sharp-note convention. */
  readonly manualTargetInfo = computed<{ noteName: string; octave: number } | null>(() => {
    const target = this.manualTarget();
    if (!target) return null;
    // Recover the nominal note at A4=440; the label identifies the string,
    // it must not shift when the user changes the reference pitch.
    const nominalMidi = frequencyToMidiNote(target.freq);
    if (nominalMidi === null) return null;
    const label = midiNoteLabel(nominalMidi);
    return {
      noteName: label.slice(0, -1),
      octave: Number(label.slice(-1)),
    };
  });

  /**
   * Cents of the played pitch against the displayed target, per frame:
   * auto → the nearest string of the current tuning;
   * manual → unclamped cents against the pinned string. Null while no pitch.
   */
  readonly frameCents = computed<number | null>(() => {
    if (this.mode() === 'auto') return this.autoTarget()?.cents ?? null;

    const valid = this.trackingState() === 'locked' && (this.frequency() ?? 0) > 0;
    if (!valid) return null;
    const target = this.manualTarget();
    if (!target) return null;
    return centsFromMidiFloat(
      frequencyToMidiFloat(this.frequency()!, this.refPitch()),
      this.targetMidi(target),
    );
  });

  /** True only while a locked pitch sits inside the tolerance window. */
  readonly inRange = computed(
    () => this.frameCents() !== null && Math.abs(this.frameCents()!) <= this.tolerance(),
  );

  /** Gated confirmation: the master switch removes every cue, not the lock itself. */
  readonly showTuned = computed(() => this.tunerSettings().inTune.enabled && this.confirmed());

  /**
   * Visual "in tune" flag handed to the display components: hold-gated
   * confirmation while the master switch is ON; instantaneous |cents| < 5
   * fallback when it's OFF.
   */
  readonly isTuned = computed(() => {
    if (this.tunerSettings().inTune.enabled) return this.showTuned();
    const cents = this.frameCents();
    return cents !== null && Math.abs(cents) < 5;
  });

  readonly needleLeft = computed(() => needlePercentFromCents(this.frameCents()));

  /** Big direction prompt above the meter. */
  readonly tunePrompt = computed(() => {
    return tuneDirectionText(this.frameCents());
  });

  /** Small cents readout under the direction prompt. */
  readonly tuneCents = computed(() => tuneCentsText(this.frameCents()));

  /**
   * Off-pitch accent blended from the user's out-of-tune color toward the
   * in-tune color as the pitch approaches the target. Null while in tune
   * (the .in-tune class takes over) or with no pitch.
   */
  readonly tuneColorHex = computed(() => {
    const cents = this.frameCents();
    if (cents === null || Math.abs(cents) < 5) return null;
    const settings = this.tunerSettings().inTune;
    return interpolateColor(settings.outOfTuneColor, settings.color, tuneColorProgress(cents));
  });

  /** Green chips only once the target actually confirms. */
  readonly chipTuned = computed(() => this.isTuned() && this.activeString() !== null);

  /**
   * Auto: the string the tuner resolved as the target. Manual: the pinned string.
   */
  readonly activeString = computed(() => {
    if (this.mode() === 'manual') return this.manualTarget()?.name ?? null;
    return this.autoTarget()?.name ?? null;
  });

  /** Label for the nearest chromatic semitone of the played pitch. */
  private readonly playedNoteLabel = computed(() => {
    if (this.trackingState() !== 'locked') return null;
    const played = frequencyToMidiFloat(this.frequency() ?? 0, this.refPitch());
    const nearest = nearestSemitone(played);
    return nearest ? midiNoteLabel(nearest.midi) : null;
  });

  /**
   * Big note below the meter. Auto: the nearest chromatic semitone of the
   * played pitch, snapping to target when close. Manual: the played note
   * while far from target, snapping to pinned target within ±50¢.
   */
  readonly targetNoteLabel = computed(() => {
    if (this.mode() === 'manual') {
      const cents = this.frameCents();
      if (cents !== null && Math.abs(cents) < 50) {
        const target = this.manualTargetInfo();
        if (target) return `${target.noteName}${target.octave}`;
      }
      return this.playedNoteLabel();
    }

    if (this.trackingState() !== 'locked') return null;
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
      const mode = this.mode();
      const tuningId = this.selectedTuningId();
      const instrumentId = this.selectedInstrumentId();
      untracked(() => {
        this.autoTuned.set([]);
        this.confirmed.set(false);
        this.clearHoldTimer();
      });
    });

    effect(() => {
      const inRange = this.inRange();
      const holdMs = this.tunerSettings().inTune.holdMs;

      if (!inRange) {
        const frameCents = this.frameCents();
        const holding = this.holdTimer !== null;
        const withinHysteresis =
          holding &&
          frameCents !== null &&
          Math.abs(frameCents) <= this.tolerance() + 1.5;

        if (!withinHysteresis) {
          this.clearHoldTimer();
          this.confirmed.set(false);
          return;
        }
      }

      if (this.confirmed()) return;

      const now = performance.now();
      const elapsed = this.holdTimer !== null ? now - this.holdStartedAt : 0;
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
      this.clearHoldTimer();
      if (this.pulseTimeout !== null) {
        clearTimeout(this.pulseTimeout);
        this.pulseTimeout = null;
      }
      if (this.isCapturing()) {
        this.audioCapture.stopCapture();
      }
    });
  }

  protected selectMode(mode: TunerMode): void {
    if (this.mode() === mode) return;

    if (mode === 'manual') {
      // Re-derive the target from the pitch if it matches a string.
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
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    } else {
      void this.audioCapture.startCapture();
    }
  }

  private notesForTuning(tuning: Tuning): readonly number[] {
    // Same A4=440 recovery as editorPresets; saved tunings are nominal notes.
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
    // Nominal note at A4=440. frameCents compares the played pitch (scaled
    // by refPitch) against this fixed target, so the target note must not
    // itself be re-rounded by the user's reference pitch.
    return frequencyToMidiNote(target.freq) ?? 69;
  }

  private confirmLock(): void {
    this.clearHoldTimer();
    if (this.confirmed()) return;

    this.confirmed.set(true);
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

  private triggerPulse(): void {
    this.pulseActive.set(true);
    if (this.pulseTimeout !== null) clearTimeout(this.pulseTimeout);
    this.pulseTimeout = setTimeout(() => this.pulseActive.set(false), LOCK_PULSE_DURATION_MS);
  }
}
