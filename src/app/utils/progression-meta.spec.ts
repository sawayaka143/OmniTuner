import { describe, expect, it } from 'vitest';
import { flattenProgression, parseProgressionMeta } from './progression-meta';
import { tonicPcOf } from './degree-to-chord';

describe('parseProgressionMeta', () => {
  it('recognizes the classic i–VI–III–VII progression in Bb', () => {
    const meta = parseProgressionMeta('Bbm, G, D, A', tonicPcOf('Bb')!, true);
    expect(meta?.degrees).toEqual(['i', 'VI', 'III', 'VII']);
  });

  it('recognizes degree-derived text regardless of whitespace', () => {
    const meta = parseProgressionMeta('Cm, A, E, B', 0, false);
    expect(meta?.degrees).toEqual(['i', 'VI', 'III', 'VII']);
  });

  it('returns null for a manually typed progression', () => {
    expect(parseProgressionMeta('Cmaj7, Bbmaj7, Abmaj7', 0, false)).toBeNull();
  });

  it('returns null when the text does not match any degree at the tonic', () => {
    expect(parseProgressionMeta('Dbmaj7, A, E, B', tonicPcOf('G')!, false)).toBeNull();
  });

  it('returns null for empty or unparsable text', () => {
    expect(parseProgressionMeta('', 0, false)).toBeNull();
    expect(parseProgressionMeta('Cm, NOTACHORD', 0, false)).toBeNull();
  });

  it('round-trips through flattenProgression at a new tonic', () => {
    const meta = parseProgressionMeta('Bbm, G, D, A', tonicPcOf('Bb')!, true)!;
    expect(meta).not.toBeNull();
    expect(flattenProgression(meta, tonicPcOf('D')!, false)).toBe('Dm, B, F#, C#');
    expect(flattenProgression(meta, 0, false)).toBe('Cm, A, E, B');
  });
});
