import { describe, expect, it } from 'vitest';

import {
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

    const plus = parseChord('A7+5');
    expect(plus.ok && plus.chord.quality).toBe('7#5');
    expect(plus.ok && plus.chord.intervals).toEqual([0, 4, 8, 10]);

    const minus = parseChord('C7-5');
    expect(minus.ok && minus.chord.intervals).toEqual([0, 4, 6, 10]);
  });

  it('parses parenthesized alterations and modifiers', () => {
    const sharp5 = parseChord('A7(#5)');
    expect(sharp5.ok && sharp5.chord.quality).toBe('7#5');
    expect(sharp5.ok && sharp5.chord.intervals).toEqual([0, 4, 8, 10]);

    const sus2 = parseChord('Fmaj7sus2(#11)');
    expect(sus2.ok && sus2.chord.intervals).toEqual([0, 2, 7, 11, 18]);
    expect(sus2.ok && sus2.chord.optionalPcs).toEqual([11]);

    const list = parseChord('C7(b9, 13)');
    expect(list.ok && list.chord.intervals).toEqual([0, 4, 7, 10, 13, 21]);
    expect(list.ok && list.chord.optionalPcs).toEqual([9]);

    const sus4 = parseChord('Cm7sus4');
    expect(sus4.ok && sus4.chord.quality).toBe('m7sus4');
    expect(sus4.ok && sus4.chord.intervals).toEqual([0, 5, 7, 10]);

    const sus9 = parseChord('Csus9');
    expect(sus9.ok && sus9.chord.intervals).toEqual([0, 5, 7, 14]);
  });

  it('accepts sixth alterations in both spellings', () => {
    const bare = parseChord('Emb6');
    const wrapped = parseChord('Em(b6)');
    expect(bare.ok && bare.chord.quality).toBe('minb6');
    expect(bare.ok && bare.chord.intervals).toEqual([0, 3, 7, 8]);
    expect(wrapped.ok && wrapped.chord.intervals).toEqual([0, 3, 7, 8]);

    const sharp6 = parseChord('Cadd9#6');
    expect(sharp6.ok && sharp6.chord.intervals).toEqual([0, 4, 7, 10, 14]);
  });

  it('accepts every minor-major spelling', () => {
    for (const symbol of ['Fmmaj7', 'Fm(maj7)', 'Fm(maj)', 'FmM7', 'FmΔ7']) {
      const result = parseChord(symbol);
      expect(result.ok, symbol).toBe(true);
      expect(result.ok && result.chord.quality, symbol).toBe('mMaj7');
      expect(result.ok && result.chord.intervals, symbol).toEqual([0, 3, 7, 11]);
    }
  });

  it('parses slash chords and keeps the bass out of the chord tones', () => {
    const overE = parseChord('C/E');
    expect(overE.ok && overE.chord.rootPc).toBe(0);
    expect(overE.ok && overE.chord.quality).toBe('maj');
    expect(overE.ok && overE.chord.pcs).toEqual([0, 4, 7]);
    expect(overE.ok && overE.chord.bassPc).toBe(4);

    const altered = parseChord('A7(#5)/C#');
    expect(altered.ok && altered.chord.rootPc).toBe(9);
    expect(altered.ok && altered.chord.bassPc).toBe(1);
    expect(altered.ok && altered.chord.intervals).toEqual([0, 4, 8, 10]);

    const sixthNine = parseChord('C6/9/G');
    expect(sixthNine.ok && sixthNine.chord.quality).toBe('6/9');
    expect(sixthNine.ok && sixthNine.chord.bassPc).toBe(7);
    expect(sixthNine.ok && sixthNine.chord.intervals).toEqual([0, 4, 7, 9, 14]);

    const flatBass = parseChord('C/Bb');
    expect(flatBass.ok && flatBass.chord.bassPc).toBe(10);
    expect(flatBass.ok && flatBass.chord.flats).toBe(true);

    const plain = parseChord('C');
    expect(plain.ok && plain.chord.bassPc).toBeUndefined();
  });

  it('rejects unknown qualities and non-symbols', () => {
    const bad = parseChord('Cfoo');
    expect(bad.ok).toBe(false);
    const notAChord = parseChord('123');
    expect(notAChord.ok).toBe(false);
    const gibberish = parseChord('C7x9');
    expect(gibberish.ok).toBe(false);
    const twoBasses = parseChord('C/E/G');
    expect(twoBasses.ok).toBe(false);
    const unbalanced = parseChord('C7(#5');
    expect(unbalanced.ok).toBe(false);
    const badBass = parseChord('C/H');
    expect(badBass.ok).toBe(false);
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

  it('keeps slash chords glued, with or without spaces', () => {
    expect(tokenizeProgression('C/E, Am')).toEqual(['C/E', 'Am']);
    expect(tokenizeProgression('A7(#5) / C# – Dm9')).toEqual(['A7(#5)/C#', 'Dm9']);
    expect(tokenizeProgression('Cmaj9 / G')).toEqual(['Cmaj9/G']);
    expect(tokenizeProgression('C6/9/G')).toEqual(['C6/9/G']);
  });

  it('still treats a slash between chords as a separator', () => {
    expect(tokenizeProgression('Cm/Gmaj')).toEqual(['Cm', 'Gmaj']);
    expect(tokenizeProgression('C/Fm7')).toEqual(['C', 'Fm7']);
  });

  it('keeps commas and spaces inside parentheses', () => {
    expect(tokenizeProgression('C7(b9, 13), Gm7')).toEqual(['C7(b9, 13)', 'Gm7']);
  });

  it('splits normally when parentheses are unbalanced', () => {
    expect(tokenizeProgression('C7(#9, Dm7')).toEqual(['C7(#9', 'Dm7']);
  });

  it('tokenizes a real-world jazz progression', () => {
    const tokens = tokenizeProgression(
      'Fmaj7 – Fm(maj7) – C/E – A7(#5)/C# – Dm9 – Fmaj7sus2(#11) – Cmaj9',
    );
    expect(tokens).toEqual([
      'Fmaj7',
      'Fm(maj7)',
      'C/E',
      'A7(#5)/C#',
      'Dm9',
      'Fmaj7sus2(#11)',
      'Cmaj9',
    ]);
    for (const token of tokens) expect(parseChord(token).ok, token).toBe(true);
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
