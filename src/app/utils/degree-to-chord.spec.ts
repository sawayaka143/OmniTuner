import { describe, expect, it } from 'vitest';
import { degreeToChordSymbol, tonicPcOf } from './degree-to-chord';
import { parseChord } from './chord-theory';

describe('degreeToChordSymbol', () => {
  it('maps diatonic degrees in C major', () => {
    expect(degreeToChordSymbol('I', 0, false)).toBe('C');
    expect(degreeToChordSymbol('vi', 0, false)).toBe('Am');
    expect(degreeToChordSymbol('ii', 0, false)).toBe('Dm');
    expect(degreeToChordSymbol('IV', 0, false)).toBe('F');
    expect(degreeToChordSymbol('V', 0, false)).toBe('G');
  });

  it('handles borrowed bVII/bIII flats', () => {
    expect(degreeToChordSymbol('bVII', 0, true)).toBe('Bb');
    expect(degreeToChordSymbol('bVII', 0, false)).toBe('A#');
    expect(degreeToChordSymbol('bIII', 0, true)).toBe('Eb');
  });

  it('passes suffixes through', () => {
    expect(degreeToChordSymbol('ii7', 0, false)).toBe('Dm7');
    expect(degreeToChordSymbol('V7', 0, false)).toBe('G7');
    expect(degreeToChordSymbol('Imaj7', 0, false)).toBe('Cmaj7');
    expect(degreeToChordSymbol('VI7', 0, false)).toBe('A7');
  });

  it('spells flats when requested', () => {
    // G minor: i = Gm, bVI = Eb (G=7, bVI is 9-1=8 -> 7+8=15%12=3=Eb/D#)
    const gPc = tonicPcOf('G')!;
    expect(degreeToChordSymbol('i', gPc, true)).toBe('Gm');
    expect(degreeToChordSymbol('bVI', gPc, true)).toBe('Eb');
    expect(degreeToChordSymbol('bVI', gPc, false)).toBe('D#');
  });

  it('every preset degree produces a parseable chord', () => {
    const roots = [0, 2, 4, 5, 7, 9, 11];
    const degrees = ['I', 'vi', 'bVII', 'bIII', 'ii7', 'V7', 'Imaj7', 'i', 'iv', 'bVI', 'bII'];
    for (const pc of roots) {
      for (const d of degrees) {
        const sym = degreeToChordSymbol(d, pc, false)!;
        expect(parseChord(sym).ok, `${d} in pc ${pc} -> ${sym}`).toBe(true);
      }
    }
  });
});

describe('tonicPcOf', () => {
  it('parses sharps and flats', () => {
    expect(tonicPcOf('C')).toBe(0);
    expect(tonicPcOf('F#')).toBe(6);
    expect(tonicPcOf('Bb')).toBe(10);
  });
});
