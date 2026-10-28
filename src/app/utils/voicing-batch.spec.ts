import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import { searchChord } from './chord-voicing';
import { runVoicingSearch, VoicingSearchMessage } from './voicing-batch';

const tuning = (): ParsedTuning => {
  const parsed = parseTuning('E2 A2 D3 G3 B3 E4');
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tuning;
};

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.chord;
};

describe('runVoicingSearch', () => {
  it('reports progress per chord and then posts the shapes in order', () => {
    const messages: VoicingSearchMessage[] = [];
    const chords = [chord('C'), null, chord('G7')];

    runVoicingSearch({ runId: 7, tuning: tuning(), chords, count: 4 }, (m) => messages.push(m));

    expect(messages.slice(0, 3)).toEqual([
      { kind: 'progress', runId: 7, done: 1, total: 3 },
      { kind: 'progress', runId: 7, done: 2, total: 3 },
      { kind: 'progress', runId: 7, done: 3, total: 3 },
    ]);
    expect(messages).toHaveLength(4);
    const result = messages[3];
    if (result.kind !== 'result') throw new Error('expected a result message');
    expect(result.runId).toBe(7);
    expect(result.shapes).toEqual([
      searchChord(tuning(), chords[0]!, 4),
      [],
      searchChord(tuning(), chords[2]!, 4),
    ]);
  });

  it('posts an empty result for an empty request', () => {
    const messages: VoicingSearchMessage[] = [];
    runVoicingSearch({ runId: 1, tuning: tuning(), chords: [], count: 6 }, (m) => messages.push(m));
    expect(messages).toEqual([{ kind: 'result', runId: 1, shapes: [] }]);
  });
});
