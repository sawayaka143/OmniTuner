import { Component, computed, signal } from '@angular/core';
import {
  ChordParseResult,
  ParsedChord,
  parseChord,
  tokenizeProgression,
} from '../../utils/chord-theory';
import { DetectedKey, detectKey } from '../../utils/key-detector';
import { TextField } from '../../ui/text-field/text-field';

interface KeyAnalysis {
  readonly total: number;
  readonly readable: number;
  readonly invalid: readonly string[];
  readonly chords: readonly ParsedChord[];
  readonly key: DetectedKey | null;
}

const EMPTY_ANALYSIS: KeyAnalysis = {
  total: 0,
  readable: 0,
  invalid: [],
  chords: [],
  key: null,
};

type ConfidenceTone = 'good' | 'warn' | 'bad';

const CONFIDENCE_TONES: Readonly<Record<DetectedKey['confidence'], ConfidenceTone>> = {
  strong: 'good',
  moderate: 'warn',
  weak: 'bad',
};

@Component({
  selector: 'app-key-finder',
  imports: [TextField],
  templateUrl: './key-finder.html',
  styleUrl: './key-finder.scss',
})
export class KeyFinder {
  protected readonly chordsText = signal('');

  protected readonly analysis = computed<KeyAnalysis>(() => {
    const tokens = tokenizeProgression(this.chordsText());
    if (!tokens.length) return EMPTY_ANALYSIS;

    const chords: ParsedChord[] = [];
    const invalid: string[] = [];
    for (const token of tokens) {
      const parsed: ChordParseResult = parseChord(token);
      if (parsed.ok) chords.push(parsed.chord);
      else invalid.push(token);
    }

    return {
      total: tokens.length,
      readable: chords.length,
      invalid,
      chords,
      key: chords.length ? detectKey(chords) : null,
    };
  });

  protected readonly chordsHint = computed<{ tone: 'good' | 'bad' | 'neutral'; text: string }>(
    () => {
      const { total, readable } = this.analysis();
      if (!total) return { tone: 'neutral', text: '0 chords parsed' };
      return {
        tone: readable < total ? 'bad' : 'good',
        text: `${total} chords parsed · ${readable} readable`,
      };
    },
  );

  protected readonly keyTone = computed<ConfidenceTone>(() => {
    const key = this.analysis().key;
    return key ? CONFIDENCE_TONES[key.confidence] : 'bad';
  });

  protected readonly alternativesLabel = computed<string>(() => {
    const key = this.analysis().key;
    if (!key) return '';
    return key.alternatives.map((alt) => `${alt.tonicName} ${alt.mode}`).join(', ');
  });
}
