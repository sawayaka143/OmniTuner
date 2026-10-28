import { ParsedChord, ParsedTuning } from './chord-theory';
import { searchChord, VoicingShape } from './chord-voicing';

export interface VoicingSearchRequest {
  readonly runId: number;
  readonly tuning: ParsedTuning;
  readonly chords: readonly (ParsedChord | null)[];
  readonly count: number;
}

export type VoicingSearchMessage =
  | {
      readonly kind: 'progress';
      readonly runId: number;
      readonly done: number;
      readonly total: number;
    }
  | {
      readonly kind: 'result';
      readonly runId: number;
      readonly shapes: readonly (readonly VoicingShape[])[];
    };

export function runVoicingSearch(
  request: VoicingSearchRequest,
  post: (message: VoicingSearchMessage) => void,
): void {
  const { runId, tuning, chords, count } = request;
  const shapes: VoicingShape[][] = [];
  chords.forEach((chord, index) => {
    shapes.push(chord ? searchChord(tuning, chord, count) : []);
    post({ kind: 'progress', runId, done: index + 1, total: chords.length });
  });
  post({ kind: 'result', runId, shapes });
}
