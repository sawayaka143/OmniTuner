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
    expect(result.chord.pcs).toEqual([10, 2, 5, 8]);
  });

  it('resolves quality aliases', () => {
    const minor = parseChord('Cm');
    expect(minor.ok && minor.chord.quality).toBe('min');
    const halfDim = parseChord('Bø');
    expect(halfDim.ok && halfDim.chord.quality).toBe('m7b5');
    const delta = parseChord('CΔ7');
    expect(delta.ok && delta.chord.quality).toBe('maj7');
  });

  it('parses the new extended chord families', () => {
    const maj9 = parseChord('Cmaj9');
    expect(maj9.ok && maj9.chord.quality).toBe('maj9');
    expect(maj9.ok && maj9.chord.pcs).toEqual([0, 4, 7, 11, 2]);
    expect(maj9.ok && maj9.chord.optionalPcs).toEqual([]);

    const thirteen = parseChord('C13');
    expect(thirteen.ok && thirteen.chord.quality).toBe('13');
    expect(thirteen.ok && thirteen.chord.pcs).toEqual([0, 4, 7, 10, 2, 5, 9]);

    expect(thirteen.ok && thirteen.chord.optionalPcs).toEqual([5, 9]);

    const b13 = parseChord('C7b13');
    expect(b13.ok && b13.chord.quality).toBe('7b13');
    expect(b13.ok && b13.chord.optionalPcs).toEqual([8]);

    const m6s9 = parseChord('Cm6/9');
    expect(m6s9.ok && m6s9.chord.quality).toBe('m6/9');
    expect(m6s9.ok && m6s9.chord.pcs).toEqual([0, 3, 7, 9, 2]);

    const mM9 = parseChord('Cm(maj9)');
    expect(mM9.ok && mM9.chord.quality).toBe('mMaj9');

    const halfDim9 = parseChord('Cø9');
    expect(halfDim9.ok && halfDim9.chord.quality).toBe('ø9');

    const sus13 = parseChord('C13sus4');
    expect(sus13.ok && sus13.chord.quality).toBe('13sus4');
    expect(sus13.ok && sus13.chord.optionalPcs).toEqual([9]);

    const add11 = parseChord('Cadd11');
    expect(add11.ok && add11.chord.quality).toBe('add11');
    const madd9 = parseChord('Cmadd9');
    expect(madd9.ok && madd9.chord.quality).toBe('madd9');
  });

  it('normalizes unicode accidentals in quality symbols', () => {
    const sharp11 = parseChord('Cmaj7♯11');
    expect(sharp11.ok && sharp11.chord.quality).toBe('maj7#11');
    expect(sharp11.ok && sharp11.chord.optionalPcs).toEqual([6]);

    const flat9 = parseChord('C7♭9');
    expect(flat9.ok && flat9.chord.quality).toBe('7b9');
  });

  it('composes arbitrary alteration combinations', () => {
    const b5b9 = parseChord('C7b5b9');
    expect(b5b9.ok && b5b9.chord.intervals).toEqual([0, 4, 6, 10, 13]);

    const sharp = parseChord('C7#9b13');
    expect(sharp.ok && sharp.chord.intervals).toEqual([0, 4, 7, 10, 15, 20]);
    expect(sharp.ok && sharp.chord.optionalPcs).toEqual([8]);

    const all = parseChord('C7b5#9b13#11');
    expect(all.ok && all.chord.intervals).toEqual([0, 4, 6, 10, 15, 18, 20]);
    expect(all.ok && all.chord.optionalPcs).toEqual([6, 8]);

    const theoretical = parseChord('Cm♭9');
    expect(theoretical.ok && theoretical.chord.intervals).toEqual([0, 3, 7, 13]);
  });

  it('rejects unknown qualities and non-symbols', () => {
    const bad = parseChord('Cfoo');
    expect(bad.ok).toBe(false);
    const notAChord = parseChord('123');
    expect(notAChord.ok).toBe(false);
    const gibberish = parseChord('C7x9');
    expect(gibberish.ok).toBe(false);
  });
});

describe('tokenizeProgression', () => {
  it('splits on commas, pipes and slashes', () => {
    expect(tokenizeProgression('Cm, Gmaj | Bb7 / Fm')).toEqual(['Cm', 'Gmaj', 'Bb7', 'Fm']);
  });

  it('falls back to whitespace splitting', () => {
    expect(tokenizeProgression('Cm Gmaj Bb7')).toEqual(['Cm', 'Gmaj', 'Bb7']);
  });

  it('keeps 6/9 chords as a single token', () => {
    expect(tokenizeProgression('C6/9, Fmaj7')).toEqual(['C6/9', 'Fmaj7']);
    expect(tokenizeProgression('Cm6/9')).toEqual(['Cm6/9']);
  });

  it('splits on progression arrows', () => {
    expect(tokenizeProgression('Am -> Dm -> G')).toEqual(['Am', 'Dm', 'G']);
    expect(tokenizeProgression('C → G → Am')).toEqual(['C', 'G', 'Am']);
  });

  it('splits on em/en dashes', () => {
    expect(tokenizeProgression('C — G – Am')).toEqual(['C', 'G', 'Am']);
  });

  it('keeps minor-suffix dashes glued to their root', () => {
    expect(tokenizeProgression('C- G')).toEqual(['C-', 'G']);
    expect(tokenizeProgression('C- -> F')).toEqual(['C-', 'F']);
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

  it('labels parallel-major mixture as borrowed in minor keys', () => {
    const gm = parseChord('Gm');
    if (!gm.ok) throw new Error('parse failed');
    const badge = computeBadge(gm.chord, 'Bb', 'Aeolian', true);
    expect(badge).toEqual({ kind: 'warn', text: '◈ vi — borrowed from Bb major' });
  });

  it('labels parallel-minor mixture as borrowed in major keys', () => {
    const bb = parseChord('Bb');
    if (!bb.ok) throw new Error('parse failed');
    const badge = computeBadge(bb.chord, 'C', 'Ionian', true);
    expect(badge).toEqual({ kind: 'warn', text: '◈ bVII — borrowed from C minor' });
  });

  it('keeps the parallel-major VI in minor keys chromatic when the quality does not match', () => {
    const g = parseChord('G');
    if (!g.ok) throw new Error('parse failed');
    const badge = computeBadge(g.chord, 'Bb', 'Aeolian', true);
    expect(badge?.kind).toBe('bad');
  });
});
