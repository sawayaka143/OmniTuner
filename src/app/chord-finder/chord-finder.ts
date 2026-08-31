import { Component, computed, inject, signal } from '@angular/core';
import { ScalePreferences } from '../services/scale-preferences';
import { InstrumentRegistry } from '../services/instrument-registry';
import { Instrument } from '../models/instrument.model';
import { textColorOn } from '../data/interval-colors';
import { PROGRESSION_PRESETS } from '../data/chord-progression-presets';
import { degreesToProgression } from '../utils/degree-to-chord';
import {
  flatsForPc,
  parseChord,
  tokenizeProgression,
  DiatonicBadge,
  ChordParseResult,
  ParsedChord,
  ParsedTuning,
  parseTuning,
  pcName,
} from '../utils/chord-theory';
import { RESULTS_PER_CHORD, searchChord, VoicingShape } from '../utils/chord-voicing';
import { DiagramLabelMode, DiagramView, NeckDiagram } from './neck-diagram/neck-diagram';
import { KeyFinder } from './key-finder/key-finder';
import { Segmented } from '../ui/segmented/segmented';
import { Listbox } from '../ui/listbox/listbox';
import { TextField } from '../ui/text-field/text-field';
import { DetectedKey, detectKey } from '../utils/key-detector';
import { computeBadgeForPc } from '../utils/chord-theory';

interface TuningOption {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export interface ChordEntry {
  readonly token: string;
  readonly parse: ChordParseResult;
  readonly shapes: readonly VoicingShape[];
  readonly badge: DiatonicBadge | null;
}

export interface GenerationResult {
  readonly tuning: ParsedTuning;
  readonly options: Record<string, unknown>;
  readonly chords: readonly ChordEntry[];
  readonly detectedKey: DetectedKey | null;
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
  imports: [NeckDiagram, Segmented, Listbox, TextField, KeyFinder],
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

  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));

  protected readonly tuningOptions = computed<readonly TuningOption[]>(() =>
    this.registry.availableTunings().map((tuning) => ({
      id: tuning.id,
      label: tuning.label,
      text: tuning.strings.map((s) => s.name).join(' '),
    })),
  );

  protected readonly viewChoices = ['tab', 'dots', 'lines'] as const;
  protected readonly labelChoices = ['notes', 'func'] as const;
  protected readonly identityFn = <T>(value: T): T => value;
  protected readonly tuningLabelFn = (o: TuningOption): string => o.label;
  protected readonly tuningAltFn = (o: TuningOption): string | null => o.text;
  protected readonly tuningTrackFn = (o: TuningOption): string => o.id;
  protected readonly instrumentLabelFn = (o: Instrument): string => o.label;
  protected readonly instrumentTrackFn = (o: Instrument): string => o.id;
  protected readonly viewLabelFn = (o: 'tab' | 'dots' | 'lines'): string => o;
  protected readonly labelChoiceLabelFn = (o: 'notes' | 'func'): string =>
    o === 'notes' ? 'notes' : 'R b3';

  protected readonly tuningText = signal(
    this.registry
      .selectedTuning()
      .strings.map((s) => s.name)
      .join(' '),
  );
  protected readonly progressionText = signal('');
  private readonly controlsStorageKey = 'omnituner.chordfinder.controlsWidth';
  private resizeState: { startX: number; startW: number } | null = null;
  private onResizeMove = (e: PointerEvent): void => this.handleResizeMove(e);
  private onResizeUp = (): void => this.handleResizeEnd();
  protected readonly viewMode = signal<DiagramView | 'tab'>('lines');
  protected readonly controlsOpen = signal(false);
  protected readonly diagramView = computed<DiagramView>(() =>
    this.viewMode() === 'dots' ? 'dots' : 'lines',
  );
  protected readonly labelMode = signal<DiagramLabelMode>('notes');
  protected readonly tuningListOpen = signal(false);
  protected readonly instruments = this.registry.instruments;
  protected readonly selectedInstrument = this.registry.selectedInstrument;
  protected readonly instrumentListOpen = signal(false);

  protected readonly results = signal<GenerationResult | null>(null);
  protected readonly detectedKey = computed(() => this.results()?.detectedKey ?? null);
  protected readonly copied = signal(false);
  private copyBuffer = '';
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const saved = this.readControlsWidth();
    if (saved !== null) this.applyControlsWidth(saved);
    if (this.preferencesState().chordRandomProgression) this.applyRandomPreset();
  }

  private pickRandomPreset() {
    const i = Math.floor(Math.random() * PROGRESSION_PRESETS.length);
    return PROGRESSION_PRESETS[i];
  }

  private applyRandomPreset(): void {
    const preset = this.pickRandomPreset();
    const tonicPc = Math.floor(Math.random() * 12);
    const useFlats = flatsForPc(tonicPc);
    const bounded = degreesToProgression(preset.degrees, tonicPc, useFlats);
    if (bounded.length < 3) return;
    this.progressionText.set(bounded.join(', '));
  }

  protected shuffleEnabled = computed(() => this.preferencesState().chordRandomProgression);

  protected shuffle(): void {
    if (!this.preferencesState().chordRandomProgression) return;
    const preset = this.pickRandomPreset();
    const tonicPc = Math.floor(Math.random() * 12);
    const useFlats = flatsForPc(tonicPc);
    const bounded = degreesToProgression(preset.degrees, tonicPc, useFlats);
    if (bounded.length < 3) return;
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
    } catch {}
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

  protected readonly parsedTuning = computed(() => parseTuning(this.tuningText()));

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

  protected onInstrumentSelect(instrument: Instrument): void {
    this.registry.selectInstrument(instrument.id);
    this.instrumentListOpen.set(false);
    this.syncTuningText();
  }

  protected onTuningSelect(option: TuningOption): void {
    this.applyTuning(option.id);
    this.tuningListOpen.set(false);
  }

  protected applyTuning(tuningId: string): void {
    const option = this.tuningOptions().find((o) => o.id === tuningId);
    if (!option) return;
    this.tuningText.set(option.text);
    this.registry.selectTuning(tuningId);
  }

  private syncTuningText(): void {
    this.tuningText.set(
      this.registry
        .selectedTuning()
        .strings.map((s) => s.name)
        .join(' '),
    );
  }

  protected toggleInstrumentList(): void {
    this.tuningListOpen.set(false);
    this.instrumentListOpen.update((open) => !open);
  }

  protected toggleTuningList(): void {
    this.instrumentListOpen.set(false);
    this.tuningListOpen.update((open) => !open);
  }

  protected onLabelModeSelect(mode: 'notes' | 'func'): void {
    this.labelMode.set(mode);
  }

  protected onProgressionInput(value: string): void {
    this.progressionText.set(value);
  }

  protected generate(): void {
    const parsed = this.parsedTuning();
    if (!parsed.ok) return;
    const tokens = tokenizeProgression(this.progressionText());
    if (!tokens.length) return;

    const validChords: ParsedChord[] = [];
    for (const token of tokens) {
      const p = parseChord(token);
      if (p.ok) validChords.push(p.chord);
    }
    const dk = validChords.length
      ? detectKey(validChords, { tuningFlats: parsed.tuning.flats })
      : null;

    const chords: ChordEntry[] = tokens.map((token) => {
      const parse = parseChord(token);
      if (!parse.ok) return { token, parse, shapes: [], badge: null };
      const shapes = searchChord(parsed.tuning, parse.chord);
      let badge: DiatonicBadge | null = null;
      if (dk) {
        const useFlats =
          validChords.some((c) => c.flats) || parsed.tuning.flats || flatsForPc(dk.tonicPc);
        badge = computeBadgeForPc(parse.chord, dk.tonicPc, dk.mode, parsed.tuning.flats, useFlats);
      }
      return { token, parse, shapes, badge };
    });

    this.results.set({
      tuning: parsed.tuning,
      options: {},
      detectedKey: dk,
      chords: chords.map((entry) => ({
        ...entry,
        shapes: entry.shapes.slice(0, RESULTS_PER_CHORD),
      })),
    });
    this.copyBuffer = this.buildCopyBuffer(parsed.tuning, chords, dk);
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

  protected relaxHints(): string {
    return 'try a different tuning or chord spelling';
  }

  private buildCopyBuffer(
    tuning: ParsedTuning,
    chords: readonly ChordEntry[],
    dk: DetectedKey | null,
  ): string {
    const parts: string[] = [];
    const keyLabel = dk ? `${dk.tonicName} ${dk.mode}` : '—';
    parts.push(`Chord finder — tuning ${tuning.labels.join(' ')} — key ${keyLabel}`);
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
