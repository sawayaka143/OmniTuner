import { describe, expect, it } from 'vitest';

import {
  computeBadge,
  midiName,
  parseChord,
  parseNoteToken,
  parseTuning,
  pcName,
  tokenizeProgression,
} from './chord-theory';

describe('parseNoteToken', () => {
  it('parses natural, sharp and flat notes', () => {
    expect(parseNoteToken('E2')).toEqual({ midi: 40, pc: 4, flats: false });
    expect(parseNoteToken('F#2')).toEqual({ midi: 42, pc: 6, flats: false });
    expect(parseNoteToken('Bb3')).toEqual({ midi: 58, pc: 10, flats: true });
    expect(parseNoteToken('D♭3')).toEqual({ midi: 49, pc: 1, flats: true });
  });

  it('rejects invalid tokens', () => {
    expect(parseNoteToken('H2')).toBeNull();
    expect(parseNoteToken('E')).toBeNull();
    expect(parseNoteToken('')).toBeNull();
  });
});

describe('parseTuning', () => {
  it('parses standard guitar tuning low-string-first', () => {
    const result = parseTuning('E2 A2 D3 G3 B3 E4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tuning.midi).toEqual([40, 45, 50, 55, 59, 64]);
    expect(result.tuning.labels).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(result.tuning.flats).toBe(false);
  });

  it('inherits flats from the first note', () => {
    const result = parseTuning('Eb2 Ab2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tuning.flats).toBe(true);
    expect(result.tuning.labels[0]).toBe('Eb2');
  });

  it('reports errors for empty or oversized tunings', () => {
    expect(parseTuning('  ')).toEqual({ ok: false, error: 'empty tuning' });
    expect(parseTuning(Array(13).fill('E2').join(' '))).toEqual({
      ok: false,
      error: 'max 12 strings',
    });
    expect(parseTuning('E2 X2')).toEqual({ ok: false, error: "bad note 'X2'" });
  });
});

describe('parseChord', () => {
  it('parses plain major chords', () => {
    const result = parseChord('C');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chord.rootPc).toBe(0);
    expect(result.chord.quality).toBe('maj');
    expect(result.chord.pcs).toEqual([0, 4, 7]);
  });

  it('parses flat roots and seventh qualities', () => {
    const result = parseChord('Bb7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chord.rootPc).toBe(10);
    expect(result.chord.flats).toBe(true);
    expect(result.chord.pcs).toEqual([10, 2, 5, 0]);
  });

  it('resolves quality aliases', () => {
    const minor = parseChord('Cm');
    expect(minor.ok && minor.chord.quality).toBe('min');
    const halfDim = parseChord('Bø');
    expect(halfDim.ok && halfDim.chord.quality).toBe('m7b5');
    const delta = parseChord('CΔ7');
    expect(delta.ok && delta.chord.quality).toBe('maj7');
  });

  it('rejects unknown qualities and non-symbols', () => {
    const bad = parseChord('Cfoo');
    expect(bad.ok).toBe(false);
    const notAChord = parseChord('123');
    expect(notAChord.ok).toBe(false);
  });
});

describe('tokenizeProgression', () => {
  it('splits on commas, pipes and slashes', () => {
    expect(tokenizeProgression('Cm, Gmaj | Bb7 / Fm')).toEqual(['Cm', 'Gmaj', 'Bb7', 'Fm']);
  });

  it('falls back to whitespace splitting', () => {
    expect(tokenizeProgression('Cm Gmaj Bb7')).toEqual(['Cm', 'Gmaj', 'Bb7']);
  });
});

describe('note names', () => {
  it('spells sharps and flats', () => {
    expect(pcName(1, false)).toBe('C#');
    expect(pcName(1, true)).toBe('Db');
    expect(midiName(60, false)).toBe('C4');
    expect(midiName(58, true)).toBe('Bb3');
  });
});

describe('computeBadge', () => {
  const cMajor = parseChord('C');
  const chord = cMajor.ok ? cMajor.chord : null;

  it('returns null without a scale root', () => {
    expect(chord && computeBadge(chord, '', 'Ionian', false)).toBeNull();
  });

  it('labels diatonic chords with their numeral', () => {
    if (!chord) throw new Error('parse failed');
    const badge = computeBadge(chord, 'C', 'Ionian', false);
    expect(badge).toEqual({ kind: 'good', text: '◈ I — diatonic to C Ionian' });
  });

  it('flags chromatic chords', () => {
    const fs = parseChord('F#m');
    if (!fs.ok) throw new Error('parse failed');
    const badge = computeBadge(fs.chord, 'C', 'Ionian', false);
    expect(badge?.kind).toBe('bad');
  });
});
