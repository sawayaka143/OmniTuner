import { describe, expect, it } from 'vitest';
import { parseChord, ParsedChord } from './chord-theory';
import { detectKey, rankKeys } from './key-detector';

const chord = (s: string): ParsedChord => {
  const r = parseChord(s);
  if (!r.ok) throw new Error(`parse failed: ${s}: ${r.error}`);
  return r.chord;
};
const chords = (...syms: string[]): ParsedChord[] => syms.map(chord);

describe('detectKey', () => {
  it('detects C Ionian for C F G', () => {
    const dk = detectKey(chords('C', 'F', 'G'));
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('C');
    expect(dk!.mode).toBe('Ionian');
    expect(dk!.confidence).toBe('strong');
  });

  it('resolves Am Dm E to C Ionian, scoring A Aeolian equally', () => {
    const chordsAmDmE = chords('Am', 'Dm', 'E');
    const dk = detectKey(chordsAmDmE);
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('C');
    expect(dk!.mode).toBe('Ionian');

    const ranked = rankKeys(chordsAmDmE);
    const aeolian = ranked.find((k) => k.tonicName === 'A' && k.mode === 'Aeolian');
    expect(aeolian?.score).toBe(ranked[0].score);
  });

  it('detects C Ionian for ii-V-I Dm7 G7 Cmaj7', () => {
    const dk = detectKey(chords('Dm7', 'G7', 'Cmaj7'));
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('C');
    expect(dk!.mode).toBe('Ionian');
  });

  it('spells flats for Bb Eb F', () => {
    const dk = detectKey(chords('Bb', 'Eb', 'F'));
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('Bb');
    expect(dk!.mode).toBe('Ionian');
  });

  it('handles single chord', () => {
    const dk = detectKey(chords('C'));
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('C');
  });

  it('returns weak or moderate for chromatic progression', () => {
    const dk = detectKey(chords('Cmaj7', 'Bbmaj7', 'Abmaj7'));
    expect(dk).not.toBeNull();
    expect(['weak', 'moderate']).toContain(dk!.confidence);
  });

  it('returns null for empty', () => {
    expect(detectKey([])).toBeNull();
  });

  it('detects C Ionian for pop progression C G Am F', () => {
    const dk = detectKey(chords('C', 'G', 'Am', 'F'));
    expect(dk).not.toBeNull();
    expect(dk!.tonicName).toBe('C');
    expect(dk!.mode).toBe('Ionian');
  });

  it('rankKeys returns sorted list', () => {
    const ranked = rankKeys(chords('C', 'F', 'G'));
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('alternatives present for strong key', () => {
    const dk = detectKey(chords('C', 'F', 'G', 'Am'));
    expect(dk!.tonicName).toBe('C');
    expect(dk!.mode).toBe('Ionian');
    expect(dk!.confidence).toBe('strong');
    expect(dk!.alternatives.length).toBeGreaterThan(0);
    for (const alt of dk!.alternatives) {
      expect(alt.score).toBeLessThanOrEqual(dk!.score);
    }
  });

  it('respects flat spelling for flat chords', () => {
    const dk = detectKey(chords('Bb', 'Eb'));
    expect(dk!.tonicName).toMatch(/b/);
  });
});
