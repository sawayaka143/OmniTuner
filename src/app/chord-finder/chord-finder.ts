import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ScalePreferences } from '../services/scale-preferences';
import { InstrumentRegistry } from '../services/instrument-registry';
import { textColorOn } from '../data/interval-colors';
import { SHARP_NAMES } from '../data/scale.constants';
import {
  ChordParseResult,
  computeBadge,
  DEGREE_LABELS,
  DiatonicBadge,
  midiName,
  MODE_NAMES,
  ModeName,
  parseChord,
  ParsedChord,
  ParsedTuning,
  parseTuning,
  pcName,
  tokenizeProgression,
} from '../utils/chord-theory';
import {
  MAX_FRET,
  OPEN_MODE_DESCRIPTIONS,
  OPEN_MODE_SUMMARIES,
  OpenStringMode,
  RESULTS_PER_CHORD,
  searchChord,
  VoicingOptions,
  VoicingShape,
} from '../utils/chord-voicing';
import { scoreErgonomics, scoreProgressionVoicings, WHY_HINTS, ERGONOMICS_WEIGHTS } from '../utils/ergonomics';
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
  'C#': 'D♭', Db: 'C♯',
  'D#': 'E♭', Eb: 'D♯',
  'F#': 'G♭', Gb: 'F♯',
  'G#': 'A♭', Ab: 'G♯',
  'A#': 'B♭', Bb: 'A♯',
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
  readonly bestNextIndex: readonly (number | null)[];
  readonly keyRoot: string;
  readonly modeName: ModeName;
}

export interface TabLine {
  readonly label: string;
  readonly padLeft: number;
  readonly symbol: string;
  readonly padRight: number;
  readonly kind: 'mute' | 'open' | 'fret';
}

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

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
  protected readonly rootAltFn = (note: string): string | null =>
    ALTERNATE_NOTES[note] ?? null;

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
  protected readonly progressionText = signal('Cm, Gmaj, Bb7, Fm');
  protected readonly openMode = signal<OpenStringMode>('allow');
  protected readonly allowInversions = signal(false);
  protected readonly allowGaps = signal(false);
  protected readonly maxStretchText = signal('4');
  protected readonly minNotesText = signal('3');
  protected readonly viewMode = signal<DiagramView | 'tab'>('lines');
  protected readonly diagramView = computed<DiagramView>(() =>
    this.viewMode() === 'dots' ? 'dots' : 'lines',
  );
  protected readonly labelMode = signal<DiagramLabelMode>('notes');
  protected readonly smoothTransitions = signal(true);
  protected readonly randomizeVoicings = signal(true);
  protected readonly tuningListOpen = signal(false);
  protected readonly modeListOpen = signal(false);
  protected readonly rootListOpen = signal(false);

  // ── Output state ─────────────────────────────────────────────────
  protected readonly results = signal<GenerationResult | null>(null);
  protected readonly status = signal<{ kind: 'plain' | 'err'; text: string }>({
    kind: 'plain',
    text: 'ready — press Generate (Ctrl+Enter)',
  });
  protected readonly stats = signal('');
  protected readonly copied = signal(false);
  private copyBuffer = '';
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    });
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
      kind: (readable < tokens.length ? 'bad' : 'good') as 'bad' | 'good',
      text: `${tokens.length} chords parsed · ${readable} readable`,
    };
  });

  protected readonly openModeDescription = computed(() => OPEN_MODE_DESCRIPTIONS[this.openMode()]);

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

  protected onProgressionInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.progressionText.set(target.value);
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

  protected openModeIndex(mode: OpenStringMode): number {
    return OPEN_MODES.indexOf(mode);
  }

  protected generate(): void {
    const parsed = this.parsedTuning();
    if (!parsed.ok) {
      this.status.set({ kind: 'err', text: `tuning: ${parsed.error}` });
      return;
    }
    const tokens = tokenizeProgression(this.progressionText());
    if (!tokens.length) {
      this.status.set({ kind: 'err', text: 'type a chord progression first…' });
      return;
    }
    const maxStretch = parseInt(this.maxStretchText(), 10);
    const minNotes = parseInt(this.minNotesText(), 10);
    if (Number.isNaN(maxStretch) || Number.isNaN(minNotes)) {
      this.status.set({ kind: 'err', text: 'max stretch / min notes must be numbers' });
      return;
    }
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
    
    const jitter = this.randomizeVoicings() ? 3.5 : 0;
    const startedAt = performance.now();
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

    const validEntries = chords.filter((c) => c.parse.ok && c.shapes.length > 0) as (ChordEntry & { parse: { ok: true } })[];
    const bestNextIndex: (number | null)[] = new Array(chords.length).fill(null);

    if (this.smoothTransitions() && validEntries.length > 1) {
      const pathfinding = scoreProgressionVoicings(
        validEntries.map((c) => c.parse.chord),
        parsed.tuning,
        validEntries.map((c) => c.shapes),
        ERGONOMICS_WEIGHTS,
        jitter,
      );
      const validIndices = chords
        .map((c, i) => (c.parse.ok && c.shapes.length ? i : -1))
        .filter((i) => i >= 0);
      for (let v = 0; v < validIndices.length - 1; v++) {
        const i = validIndices[v];
        const nextI = validIndices[v + 1];
        if (nextI !== i + 1) continue;
        bestNextIndex[i] = pathfinding.path[v] ?? null;
      }
    } else {
      chords = chords.map((entry) => {
        if (!entry.parse.ok) return entry;
        const parsedEntry = entry as ChordEntry & { parse: { ok: true } };
        const scored = entry.shapes.map((shape) => ({
          shape,
          cost: scoreErgonomics(shape, parsed.tuning, parsedEntry.parse.chord, true, ERGONOMICS_WEIGHTS, jitter).cost,
        }));
        scored.sort((a, b) => a.cost - b.cost);
        return { ...entry, shapes: scored.map((s) => s.shape) };
      });
    }

    // Display the best few even though the search/randomization used a wider pool.
    chords = chords.map((entry) => ({
      ...entry,
      shapes: entry.shapes.slice(0, RESULTS_PER_CHORD),
    }));

    const totalVoicings = chords.reduce((sum, c) => sum + c.shapes.length, 0);
    this.results.set({
      tuning: parsed.tuning,
      options,
      chords,
      bestNextIndex,
      keyRoot: this.scaleRootText().trim(),
      modeName: this.modeName(),
    });
    this.copyBuffer = this.buildCopyBuffer(parsed.tuning, chords);
    this.stats.set(
      `${chords.length} chords · ${totalVoicings} voicings · ${(performance.now() - startedAt).toFixed(1)} ms`,
    );
    this.status.set({
      kind: 'plain',
      text: `done — top ${RESULTS_PER_CHORD} per chord, best ergonomics first`,
    });
  }

  protected clearResults(): void {
    this.results.set(null);
    this.copyBuffer = '';
    this.stats.set('');
    this.status.set({ kind: 'plain', text: 'cleared — ready' });
  }

  protected async copyTab(): Promise<void> {
    if (!this.copyBuffer) {
      this.status.set({ kind: 'err', text: 'nothing to copy yet — generate first' });
      return;
    }
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
      this.status.set({ kind: 'plain', text: 'tab copied to clipboard' });
      this.copied.set(true);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => this.copied.set(false), 1100);
    } else {
      this.status.set({ kind: 'err', text: 'copy failed' });
    }
  }

  protected rulesSummary(result: GenerationResult): string {
    const { options } = result;
    const inversions = options.allowInversions
      ? 'inversions allowed'
      : 'inversions off — root must be lowest';
    const gaps = options.allowGaps ? 'inner mutes allowed' : 'inner mutes banned';
    return `rules   stretch ≤ ${options.maxStretch} (opens ignored) · ≥ ${options.minNotes} notes · ${OPEN_MODE_SUMMARIES[options.openMode]} · ${inversions} · ${gaps} · frets 0-${MAX_FRET}`;
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

  protected shapeInfo(shape: VoicingShape, chord: ParsedChord, flats: boolean): string {
    const notes = [...shape.sounding].sort(
      (a, b) => a.midi - b.midi || a.stringIndex - b.stringIndex,
    );
    const noteStr = notes
      .map((n) => `${midiName(n.midi, flats)}(${DEGREE_LABELS[mod12(n.midi - chord.rootPc)]})`)
      .join(' ');
    const bassStr = shape.bassIsRoot ? 'root' : DEGREE_LABELS[mod12(shape.bassMidi - chord.rootPc)];
    return `notes low->high: ${noteStr}   |   bass: ${bassStr}   |   span: ${shape.span} fret(s)   |   open strings: ${shape.openCount}`;
  }

  protected ergonomicsHint(shape: VoicingShape, chord: ParsedChord, tuning: ParsedTuning): string {
    const score = scoreErgonomics(shape, tuning, chord);
    const labels = score.factors.map((f) => WHY_HINTS[f]);
    return labels.length ? labels.join(' · ') : 'balanced';
  }

  protected isBestTransition(chordIndex: number, shapeIndex: number): boolean {
    return this.results()?.bestNextIndex[chordIndex] === shapeIndex;
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
      const flats = parse.chord.flats || tuning.flats;
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
        parts.push(this.shapeInfo(shape, parse.chord, flats));
        parts.push('');
      });
    }
    return parts.join('\n');
  }
}
