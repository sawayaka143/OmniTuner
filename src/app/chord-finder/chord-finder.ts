import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { ScalePreferences } from '../services/scale-preferences';
import { InstrumentRegistry } from '../services/instrument-registry';
import { textColorOn } from '../data/interval-colors';
import { SHARP_NAMES, FLAT_NAMES } from '../data/scale.constants';
import { PROGRESSION_PRESETS } from '../data/chord-progression-presets';
import { degreesToProgression, tonicPcOf } from '../utils/degree-to-chord';
import {
  flatsForPc,
  parseChord,
  tokenizeProgression,
  computeBadge,
  DiatonicBadge,
  MODE_NAMES,
  ModeName,
  ChordParseResult,
  ParsedChord,
  ParsedTuning,
  parseTuning,
  pcName,
} from '../utils/chord-theory';
import {
  flattenProgression,
  parseProgressionMeta,
  ProgressionMeta,
} from '../utils/progression-meta';
import {
  MAX_FRET,
  OpenStringMode,
  RESULTS_PER_CHORD,
  searchChord,
  VoicingOptions,
  VoicingShape,
} from '../utils/chord-voicing';
import { scoreErgonomics, ERGONOMICS_WEIGHTS } from '../utils/ergonomics';
import { DiagramLabelMode, DiagramView, NeckDiagram } from './neck-diagram/neck-diagram';
import { Toggle } from '../ui/toggle/toggle';
import { Segmented } from '../ui/segmented/segmented';
import { Listbox } from '../ui/listbox/listbox';
import { TextField } from '../ui/text-field/text-field';

interface TuningOption {
  readonly id: string;
  readonly label: string;
  /** Whitespace-separated note tokens, low string first. */
  readonly text: string;
}

const OPEN_MODES: readonly OpenStringMode[] = ['allow', 'require', 'mostly', 'exclude'];

const OPEN_MODE_SHORT_LABELS: Readonly<Record<OpenStringMode, string>> = {
  allow: 'free',
  require: '≥1 open',
  mostly: 'mostly',
  exclude: 'no opens',
};

/** Enharmonic alternate spelling shown as the dropdown secondary text. */
const ALTERNATE_NOTES: Readonly<Record<string, string>> = {
  'C#': 'D♭',
  Db: 'C♯',
  'D#': 'E♭',
  Eb: 'D♯',
  'F#': 'G♭',
  Gb: 'F♯',
  'G#': 'A♭',
  Ab: 'G♯',
  'A#': 'B♭',
  Bb: 'A♯',
};

export interface ChordEntry {
  readonly token: string;
  readonly parse: ChordParseResult;
  readonly shapes: readonly VoicingShape[];
  readonly badge: DiatonicBadge | null;
}

export interface GenerationResult {
  readonly tuning: ParsedTuning;
  readonly options: VoicingOptions;
  readonly chords: readonly ChordEntry[];
}

export interface TabLine {
  readonly label: string;
  readonly padLeft: number;
  readonly symbol: string;
  readonly padRight: number;
  readonly kind: 'mute' | 'open' | 'fret';
}

@Component({
  selector: 'app-chord-finder',
  imports: [NeckDiagram, Toggle, Segmented, Listbox, TextField],
  templateUrl: './chord-finder.html',
  styleUrl: './chord-finder.scss',
  host: {
    '(keydown.control.enter)': 'generate()',
    '(keydown.meta.enter)': 'generate()',
  },
})
export class ChordFinder {
  private readonly preferences = inject(ScalePreferences);
  private readonly registry = inject(InstrumentRegistry);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));

  /** Built-in + custom tunings of the currently selected instrument. */
  protected readonly tuningOptions = computed<readonly TuningOption[]>(() =>
    this.registry.availableTunings().map((tuning) => ({
      id: tuning.id,
      label: tuning.label,
      text: tuning.strings.map((s) => s.name).join(' '),
    })),
  );

  protected readonly instrumentLabel = computed(() => this.registry.selectedInstrument().label);

  protected readonly modeNames = MODE_NAMES;
  protected readonly openModes = OPEN_MODES;
  protected readonly openModeShortLabels = OPEN_MODE_SHORT_LABELS;
  protected readonly viewChoices = ['tab', 'dots', 'lines'] as const;
  protected readonly labelChoices = ['notes', 'func'] as const;
  protected readonly maxFret = MAX_FRET;
  protected readonly identityFn = <T>(value: T): T => value;
  protected readonly tuningLabelFn = (o: TuningOption): string => o.label;
  protected readonly tuningAltFn = (o: TuningOption): string | null => o.text;
  protected readonly tuningTrackFn = (o: TuningOption): string => o.id;
  protected readonly openModeLabelFn = (o: OpenStringMode): string => OPEN_MODE_SHORT_LABELS[o];
  protected readonly viewLabelFn = (o: 'tab' | 'dots' | 'lines'): string => o;
  protected readonly labelChoiceLabelFn = (o: 'notes' | 'func'): string =>
    o === 'notes' ? 'notes' : 'R b3';

  protected readonly rootNotes = SHARP_NAMES;
  /** Enharmonic alternate shown as secondary text (e.g. `C#` → `D♭`). */
  protected readonly rootAltFn = (note: string): string | null => ALTERNATE_NOTES[note] ?? null;

  /** The tuning option matching the currently selected registry tuning. */
  protected readonly selectedTuningOption = computed<TuningOption | null>(() => {
    const id = this.registry.selectedTuningId();
    return this.tuningOptions().find((o) => o.id === id) ?? null;
  });

  protected readonly tuningHintTone = computed<'good' | 'bad' | 'neutral'>(() => {
    const kind = this.tuningHint().kind;
    return kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : 'neutral';
  });

  protected readonly progressionHintTone = computed<'good' | 'bad' | 'neutral'>(() => {
    const kind = this.progressionHint().kind;
    return kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : 'neutral';
  });

  // ── Control state ────────────────────────────────────────────────
  protected readonly tuningText = signal(
    this.registry
      .selectedTuning()
      .strings.map((s) => s.name)
      .join(' '),
  );
  protected readonly scaleRootText = signal('');
  protected readonly scaleRoot = computed(() => this.scaleRootText().trim() || 'C');
  protected readonly modeName = signal<ModeName>('Aeolian');
  protected readonly progressionText = signal('');
  /**
   * Degree source of the visible progression, when it is degree-derived
   * (shuffle/random). Null for manually typed progressions, which must not
   * be transposed when the root changes.
   */
  private readonly progressionMeta = signal<ProgressionMeta | null>(null);
  protected readonly openMode = signal<OpenStringMode>('allow');
  protected readonly allowInversions = signal(false);
  protected readonly allowGaps = signal(false);
  protected readonly maxStretchText = signal('4');
  protected readonly minNotesText = signal('3');
  private readonly controlsStorageKey = 'omnituner.chordfinder.controlsWidth';
  private resizeState: { startX: number; startW: number } | null = null;
  private onResizeMove = (e: PointerEvent): void => this.handleResizeMove(e);
  private onResizeUp = (): void => this.handleResizeEnd();
  protected readonly viewMode = signal<DiagramView | 'tab'>('lines');
  protected readonly diagramView = computed<DiagramView>(() =>
    this.viewMode() === 'dots' ? 'dots' : 'lines',
  );
  protected readonly labelMode = signal<DiagramLabelMode>('notes');
  protected readonly randomizeVoicings = signal(true);
  protected readonly tuningListOpen = signal(false);
  protected readonly modeListOpen = signal(false);
  protected readonly rootListOpen = signal(false);

  // ── Output state ─────────────────────────────────────────────────
  protected readonly results = signal<GenerationResult | null>(null);
  protected readonly copied = signal(false);
  private copyBuffer = '';
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const saved = this.readControlsWidth();
    if (saved !== null) this.applyControlsWidth(saved);
    if (this.preferencesState().chordRandomProgression) this.applyRandomPreset();
    effect(() => {
      // Transpose a degree-derived progression when the root changes.
      // Reads scaleRoot so the effect re-runs on key edits, and deliberately
      // avoids progressionText to keep it acyclic.
      const meta = this.progressionMeta();
      if (!meta) return;
      const rootRaw = this.scaleRoot();
      const tonic = tonicPcOf(rootRaw);
      if (tonic === null) return;
      const useFlats = flatsForPc(tonic);
      this.progressionText.set(flattenProgression(meta, tonic, useFlats));
    });
    this.destroyRef.onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.detachResizeListeners();
    });
  }

  private pickRandomPreset() {
    const i = Math.floor(Math.random() * PROGRESSION_PRESETS.length);
    return PROGRESSION_PRESETS[i];
  }

  private pickRandomKey() {
    const pc = Math.floor(Math.random() * 12);
    const flats = flatsForPc(pc);
    const name = (flats ? FLAT_NAMES : SHARP_NAMES)[pc];
    const roll = Math.random();
    let mode: ModeName;
    if (roll < 0.4) mode = 'Ionian';
    else if (roll < 0.8) mode = 'Aeolian';
    else {
      const others: ModeName[] = ['Dorian', 'Mixolydian', 'Lydian'];
      mode = others[Math.floor(Math.random() * others.length)];
    }
    return { pc, name, flats, mode };
  }

  private applyRandomPreset(): void {
    const preset = this.pickRandomPreset();
    const { pc, name, flats, mode: presetMode } = this.pickRandomKey();
    const mode: ModeName = preset.mode ?? presetMode;
    const tonicPc = tonicPcOf(name) ?? pc;
    const useFlats = flats;
    const bounded = degreesToProgression(preset.degrees, tonicPc, useFlats);
    if (bounded.length < 3) return;
    this.progressionMeta.set({ presetId: preset.id, degrees: preset.degrees });
    this.scaleRootText.set(name);
    this.modeName.set(mode);
    this.progressionText.set(bounded.join(', '));
  }

  protected shuffleEnabled = computed(() => this.preferencesState().chordRandomProgression);

  protected shuffle(): void {
    if (!this.preferencesState().chordRandomProgression) return;
    const preset = this.pickRandomPreset();
    const rawRoot = this.scaleRootText().trim() || this.scaleRoot();
    const tonic = tonicPcOf(rawRoot) ?? 0;
    const useFlats =
      rawRoot.includes('b') || rawRoot.includes('♭')
        ? true
        : rawRoot.includes('#') || rawRoot.includes('♯')
          ? false
          : flatsForPc(tonic);
    const bounded = degreesToProgression(preset.degrees, tonic, useFlats);
    if (bounded.length < 3) return;
    this.progressionMeta.set({ presetId: preset.id, degrees: preset.degrees });
    this.progressionText.set(bounded.join(', '));
    this.generate();
  }

  protected onResizeStart(event: PointerEvent): void {
    event.preventDefault();
    const el = document.querySelector('.finder-columns');
    if (!el) return;
    const w = parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 300;
    this.resizeState = { startX: event.clientX, startW: w };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.onResizeMove);
    window.addEventListener('pointerup', this.onResizeUp);
    window.addEventListener('pointercancel', this.onResizeUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  private handleResizeMove(event: PointerEvent): void {
    if (!this.resizeState) return;
    const dx = event.clientX - this.resizeState.startX;
    const next = Math.min(420, Math.max(240, this.resizeState.startW + dx));
    this.applyControlsWidth(next);
  }

  private handleResizeEnd(): void {
    if (!this.resizeState) return;
    const el = document.querySelector('.finder-columns');
    const w = el ? parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 0 : 0;
    if (w) this.persistControlsWidth(w);
    this.detachResizeListeners();
  }

  private detachResizeListeners(): void {
    window.removeEventListener('pointermove', this.onResizeMove);
    window.removeEventListener('pointerup', this.onResizeUp);
    window.removeEventListener('pointercancel', this.onResizeUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this.resizeState = null;
  }

  private applyControlsWidth(px: number): void {
    const el = document.querySelector<HTMLElement>('.finder-columns');
    if (el) el.style.setProperty('--controls-w', `${px}px`);
  }

  protected onResizeKeydown(event: KeyboardEvent): void {
    const el = document.querySelector<HTMLElement>('.finder-columns');
    if (!el) return;
    const w = parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 300;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.applyControlsWidth(Math.max(240, w - 20));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.applyControlsWidth(Math.min(420, w + 20));
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.applyControlsWidth(240);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.applyControlsWidth(420);
    } else {
      return;
    }
    this.persistControlsWidth(
      parseFloat(getComputedStyle(el).getPropertyValue('--controls-w')) || 300,
    );
  }

  private persistControlsWidth(px: number): void {
    try {
      localStorage.setItem(this.controlsStorageKey, String(Math.round(px)));
    } catch {
      /* ignore */
    }
  }

  private readControlsWidth(): number | null {
    try {
      const raw = localStorage.getItem(this.controlsStorageKey);
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? Math.min(420, Math.max(240, n)) : null;
    } catch {
      return null;
    }
  }

  // ── Live validation ──────────────────────────────────────────────

  protected readonly parsedTuning = computed(() => parseTuning(this.tuningText()));

  protected readonly parsedTuningValue = computed<ParsedTuning | null>(() => {
    const parsed = this.parsedTuning();
    return parsed.ok ? parsed.tuning : null;
  });

  protected readonly tuningError = computed<string>(() => {
    const parsed = this.parsedTuning();
    return parsed.ok ? '' : parsed.error;
  });

  protected readonly tuningHint = computed(() => {
    const parsed = this.parsedTuning();
    return parsed.ok
      ? {
          kind: 'good' as const,
          text: `✓ ${parsed.tuning.midi.length} strings · ${parsed.tuning.labels.join(' · ')}`,
        }
      : { kind: 'bad' as const, text: `✕ ${parsed.error}` };
  });

  protected readonly progressionHint = computed(() => {
    const tokens = tokenizeProgression(this.progressionText());
    if (!tokens.length) return { kind: 'idle' as const, text: '0 chords parsed' };
    const readable = tokens.filter((t) => parseChord(t).ok).length;
    return {
      kind: readable < tokens.length ? 'bad' : 'good',
      text: `${tokens.length} chords parsed · ${readable} readable`,
    };
  });

  // ── Actions ──────────────────────────────────────────────────────
  protected onTuningPresetChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) this.applyTuning(target.value);
  }

  protected onTuningInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.tuningText.set(target.value);
  }

  protected onModeChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const mode = MODE_NAMES.find((name) => name === target.value);
    if (mode) this.modeName.set(mode);
  }

  protected onProgressionInput(value: string): void {
    this.progressionText.set(value);
    const tonic = tonicPcOf(this.scaleRoot()) ?? 0;
    this.progressionMeta.set(parseProgressionMeta(value, tonic, flatsForPc(tonic)));
  }

  protected onMaxStretchInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.maxStretchText.set(target.value);
  }

  protected onMinNotesInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.minNotesText.set(target.value);
  }

  protected applyTuning(tuningId: string): void {
    const option = this.tuningOptions().find((o) => o.id === tuningId);
    if (!option) return;
    this.tuningText.set(option.text);
    this.registry.selectTuning(tuningId);
  }

  protected onTuningSelect(option: TuningOption): void {
    this.applyTuning(option.id);
    this.tuningListOpen.set(false);
  }

  protected setOpenMode(mode: OpenStringMode): void {
    this.openMode.set(mode);
  }

  protected onLabelModeSelect(mode: 'notes' | 'func'): void {
    this.labelMode.set(mode);
  }

  protected toggleTuningList(): void {
    this.modeListOpen.set(false);
    this.rootListOpen.set(false);
    this.tuningListOpen.update((open) => !open);
  }

  protected toggleModeList(): void {
    this.tuningListOpen.set(false);
    this.rootListOpen.set(false);
    this.modeListOpen.update((open) => !open);
  }

  protected toggleRootList(): void {
    this.tuningListOpen.set(false);
    this.modeListOpen.set(false);
    this.rootListOpen.update((open) => !open);
  }

  protected onModeSelect(mode: ModeName): void {
    this.modeName.set(mode);
    this.modeListOpen.set(false);
  }

  protected onScaleRootSelect(note: string): void {
    this.scaleRootText.set(note);
    this.rootListOpen.set(false);
  }

  protected generate(): void {
    const parsed = this.parsedTuning();
    if (!parsed.ok) return;
    const tokens = tokenizeProgression(this.progressionText());
    if (!tokens.length) return;
    const maxStretch = parseInt(this.maxStretchText(), 10);
    const minNotes = parseInt(this.minNotesText(), 10);
    if (Number.isNaN(maxStretch) || Number.isNaN(minNotes)) return;
    const options: VoicingOptions = {
      openMode: this.openMode(),
      allowInversions: this.allowInversions(),
      allowGaps: this.allowGaps(),
      maxStretch,
      minNotes,
      rejectUnbarrable: true,
      // Search a wider pool than we display so randomization has diverse,
      // still-good voicings to pick from (display stays at RESULTS_PER_CHORD).
      candidateCount: 12,
    };

    const doJitter = this.randomizeVoicings();
    let chords: ChordEntry[] = tokens.map((token) => {
      const parse = parseChord(token);
      if (!parse.ok) return { token, parse, shapes: [], badge: null };
      const shapes = searchChord(parsed.tuning, parse.chord, options);
      return {
        token,
        parse,
        shapes,
        badge: computeBadge(
          parse.chord,
          this.scaleRootText(),
          this.modeName(),
          parsed.tuning.flats,
        ),
      };
    });

    chords = chords.map((entry) => {
      if (!entry.parse.ok) return entry;
      const parsedEntry = entry as ChordEntry & { parse: { ok: true } };
      // Bound jitter: diversify within quality band, never promote outside bestCost+2.
      const baseCosts = entry.shapes.map(
        (shape) =>
          scoreErgonomics(
            shape,
            parsed.tuning,
            parsedEntry.parse.chord,
            true,
            ERGONOMICS_WEIGHTS,
            0,
          ).cost,
      );
      const bestCost = baseCosts.length ? Math.min(...baseCosts) : 0;
      const scored = entry.shapes.map((shape, i) => {
        const jitter = doJitter && baseCosts[i] <= bestCost + 2 ? 1.2 : 0;
        return {
          shape,
          cost: scoreErgonomics(
            shape,
            parsed.tuning,
            parsedEntry.parse.chord,
            true,
            ERGONOMICS_WEIGHTS,
            jitter,
          ).cost,
        };
      });
      scored.sort((a, b) => a.cost - b.cost);
      return { ...entry, shapes: scored.map((s) => s.shape) };
    });

    // Display the best few even though the search/randomization used a wider pool.
    chords = chords.map((entry) => ({
      ...entry,
      shapes: entry.shapes.slice(0, RESULTS_PER_CHORD),
    }));

    this.results.set({
      tuning: parsed.tuning,
      options,
      chords,
    });
    this.copyBuffer = this.buildCopyBuffer(parsed.tuning, chords);
  }

  protected clearResults(): void {
    this.results.set(null);
    this.copyBuffer = '';
  }

  protected async copyTab(): Promise<void> {
    if (!this.copyBuffer) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(this.copyBuffer);
      ok = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = this.copyBuffer;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
    }
    if (ok) {
      this.copied.set(true);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => this.copied.set(false), 1100);
    }
  }

  protected chordTonesLabel(chord: ParsedChord, flats: boolean): string {
    const optional = new Set(chord.optionalPcs);
    const tones = chord.pcs
      .map((pc) => {
        const name = pcName(pc, flats);
        return optional.has(pc) ? `(${name})` : name;
      })
      .join(' ');
    return `${pcName(chord.rootPc, flats)} ${chord.quality} · tones ${tones}`;
  }

  protected flatsFor(result: GenerationResult, chord: ParsedChord): boolean {
    return chord.flats || result.tuning.flats;
  }

  protected tabLines(shape: VoicingShape, tuning: ParsedTuning): TabLine[] {
    const wide = shape.frets.some((f) => f !== null && f >= 10);
    const width = wide ? 8 : 7;
    const lines: TabLine[] = [];
    for (let s = tuning.midi.length - 1; s >= 0; s--) {
      const fret = shape.frets[s];
      const symbol = fret === null ? 'x' : String(fret);
      const padLeft = Math.floor((width - symbol.length) / 2);
      lines.push({
        label: tuning.labels[s].padEnd(5),
        padLeft,
        symbol,
        padRight: width - symbol.length - padLeft,
        kind: fret === null ? 'mute' : fret === 0 ? 'open' : 'fret',
      });
    }
    return lines;
  }

  protected relaxHints(options: VoicingOptions): string {
    const hints: string[] = [];
    if (options.openMode === 'exclude') hints.push('allow open strings');
    if (options.openMode === 'mostly') hints.push('relax mostly open');
    if (options.openMode === 'require') hints.push('drop the open requirement');
    if (!options.allowInversions) hints.push('enable inversions');
    if (options.maxStretch < 6) hints.push('widen the stretch');
    if (!options.allowGaps) hints.push('allow string gaps');
    return hints.join(' · ') || 'relax the rules';
  }

  private buildCopyBuffer(tuning: ParsedTuning, chords: readonly ChordEntry[]): string {
    const parts: string[] = [];
    parts.push(
      `Chord finder — tuning ${tuning.labels.join(' ')} — key ${this.scaleRootText().trim() || '—'} ${this.modeName()}`,
    );
    parts.push('');
    for (const entry of chords) {
      const parse = entry.parse;
      if (!parse.ok) {
        parts.push(`=== ${entry.token} ===`, `!! ${parse.error}`, '');
        continue;
      }
      entry.shapes.forEach((shape, k) => {
        parts.push(`=== ${parse.chord.symbol} - Fingering ${k + 1} ===`);
        const wide = shape.frets.some((f) => f !== null && f >= 10);
        const width = wide ? 8 : 7;
        for (let s = tuning.midi.length - 1; s >= 0; s--) {
          const fret = shape.frets[s];
          const symbol = fret === null ? 'x' : String(fret);
          const padLeft = Math.floor((width - symbol.length) / 2);
          const padRight = width - symbol.length - padLeft;
          parts.push(
            `${tuning.labels[s].padEnd(5)}|${'-'.repeat(padLeft)}${symbol}${'-'.repeat(padRight)}|`,
          );
        }
        parts.push('');
      });
    }
    return parts.join('\n');
  }
}
