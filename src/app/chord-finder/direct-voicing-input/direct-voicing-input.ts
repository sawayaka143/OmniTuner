import { Component, computed, input, output } from '@angular/core';
import { ParsedChord, ParsedTuning } from '../../utils/chord-theory';
import { VoicingShape } from '../../utils/chord-voicing';
import { ergonomicsFeatures, WHY_HINTS } from '../../utils/ergonomics';
import { TextField } from '../../ui/text-field/text-field';
import {
  directPlayabilityWarning,
  DirectParseOk,
  DirectParseResult,
  parseDirectInput,
} from '../../utils/direct-input';

export interface DirectPinPayload {
  readonly shape: VoicingShape;
  readonly chord: ParsedChord;
}

/** Short reason a fingering ranks as it does (same labels as the search UI). */
export function ergonomicsHint(
  shape: VoicingShape,
  chord: ParsedChord,
  tuning: ParsedTuning,
): string {
  const factors = ergonomicsFeatures(shape, tuning, chord);
  const labels: string[] = [];
  if (!factors.bassIsRoot) labels.push(WHY_HINTS['bass']);
  if (factors.openCount) labels.push(WHY_HINTS['open']);
  if (factors.stretchSpan > 0) labels.push(WHY_HINTS['stretch']);
  if (factors.barreCount > 0) labels.push(WHY_HINTS['barre']);
  if (factors.position >= 7) labels.push(WHY_HINTS['position']);
  if (factors.rootDoubled) labels.push(WHY_HINTS['doubling']);
  if (factors.hasStringSkip || factors.hasThumbFret) labels.push(WHY_HINTS['thumb']);
  return labels.length ? labels.join(' · ') : 'balanced';
}

/**
 * Direct voicing entry: type a specific fingering (bottom → top) and pin it.
 * Bypasses the DFS search entirely — the shape is parsed as-is.
 */
@Component({
  selector: 'app-direct-voicing-input',
  imports: [TextField],
  templateUrl: './direct-voicing-input.html',
  styleUrl: './direct-voicing-input.scss',
})
export class DirectVoicingInput {
  readonly tuning = input.required<ParsedTuning>();
  readonly chordOptions = input<readonly ParsedChord[]>([]);
  readonly pinned = input(false);

  readonly pin = output<DirectPinPayload>();
  readonly unpin = output<DirectPinPayload>();

  readonly text = input.required<string>();
  readonly textChange = output<string>();

  protected readonly parseResult = computed<DirectParseResult>(() =>
    parseDirectInput(this.text(), this.tuning()),
  );

  /** The ok-variant of the parse, or null when invalid. */
  protected readonly parsed = computed<DirectParseOk | null>(() => {
    const result = this.parseResult();
    return result.ok ? result : null;
  });

  protected readonly fretText = computed(() => {
    const parsed = this.parsed();
    return parsed ? parsed.frets.map((f) => (f === null ? 'x' : String(f))).join(' ') : '';
  });

  protected readonly previewLines = computed(() => {
    const parsed = this.parsed();
    if (!parsed) return [];
    const tuning = this.tuning();
    const wide = parsed.frets.some((f) => f !== null && f >= 10);
    const width = wide ? 8 : 7;
    return [...tuning.labels]
      .map((label, s) => ({ label, fret: parsed.frets[s], width }))
      .reverse();
  });

  protected readonly validationHint = computed(() => {
    const parsed = this.parsed();
    if (!parsed) return this.parseError();
    const warning = directPlayabilityWarning(parsed.shape);
    if (warning) return warning;
    const chord = this.inferredChord();
    const chordText = chord ? ` · ${chord.symbol}` : '';
    return `✓ ${this.tuning().midi.length} strings · span ${parsed.shape.span}${chordText}`;
  });

  /** Error message when the parse is invalid. */
  protected readonly parseError = computed<string>(() => {
    const result = this.parseResult();
    return result.ok ? '' : result.error;
  });

  protected readonly hintTone = computed<'good' | 'bad' | 'neutral'>(() =>
    this.parsed() ? 'good' : 'bad',
  );

  protected readonly inferredChord = computed<ParsedChord | null>(() => this.parsed()?.inferredChord ?? null);

  protected readonly ergonomics = computed(() => {
    const parsed = this.parsed();
    if (!parsed) return '';
    const chord = this.inferredChord() ?? this.chordOptions()[0];
    if (!chord) return 'pin this shape as a custom voicing';
    return `why · ${ergonomicsHint(parsed.shape, chord, this.tuning())}`;
  });

  protected readonly canPin = computed(() => this.parsed() !== null);

  protected readonly actionLabel = computed(() =>
    this.pinned() ? 'Unpin this shape' : 'Pin this shape',
  );

  protected onInput(value: string): void {
    this.textChange.emit(value);
  }

  protected onPinClick(): void {
    const parsed = this.parsed();
    if (!parsed) return;
    const payload: DirectPinPayload = { shape: parsed.shape, chord: this.chosenChord() };
    if (this.pinned()) {
      this.unpin.emit(payload);
    } else {
      this.pin.emit(payload);
    }
  }

  /** The chord this shape gets pinned under: progression chord → inferred → custom. */
  protected chosenChord(): ParsedChord {
    const option = this.chordOptions()[0];
    if (option) return option;
    const inferred = this.inferredChord();
    if (inferred) return inferred;
    return this.customChord();
  }

  /** Generic fallback chord for shapes that don't map to a named chord. */
  protected customChord(): ParsedChord {
    const parsed = this.parsed();
    const rootPc = parsed ? parsed.shape.bassMidi % 12 : 0;
    return {
      symbol: 'custom',
      rootPc,
      quality: '',
      intervals: [],
      pcs: parsed ? [...new Set(parsed.shape.sounding.map((n) => n.midi % 12))] : [],
      optionalPcs: [],
      flats: this.tuning().flats,
    };
  }
}
