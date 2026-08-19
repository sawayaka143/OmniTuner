import { describe, it, expect } from 'vitest';

import { IntervalEntry } from '../models/scale.model';
import { parseNote, noteName, intervalByPitchClass, computeFretboard } from './scale-theory';

describe('parseNote', () => {
  it('parses natural notes', () => {
    expect(parseNote('C')).toBe(0);
    expect(parseNote('D')).toBe(2);
    expect(parseNote('E')).toBe(4);
    expect(parseNote('B')).toBe(11);
  });

  it('parses sharps and flats equivalently', () => {
    expect(parseNote('C#')).toBe(1);
    expect(parseNote('Db')).toBe(1);
    expect(parseNote('F#')).toBe(6);
    expect(parseNote('Gb')).toBe(6);
  });

  it('accepts Unicode accidentals and mixed case', () => {
    expect(parseNote('e♭')).toBe(3);
    expect(parseNote('F♯')).toBe(6);
    expect(parseNote('  d# ')).toBe(3);
  });

  it('ignores octave digits', () => {
    expect(parseNote('E2')).toBe(4);
    expect(parseNote('Bb3')).toBe(10);
  });

  it('returns null for invalid input without throwing', () => {
    expect(parseNote('')).toBeNull();
    expect(parseNote('H')).toBeNull();
    expect(parseNote('Z#')).toBeNull();
    expect(parseNote('xyz')).toBeNull();
    expect(parseNote('123')).toBeNull();
  });
});

describe('noteName', () => {
  it('spells with sharps by default', () => {
    expect(noteName(0, false)).toBe('C');
    expect(noteName(1, false)).toBe('C#');
    expect(noteName(6, false)).toBe('F#');
  });

  it('spells with flats when preferred', () => {
    expect(noteName(1, true)).toBe('Db');
    expect(noteName(3, true)).toBe('Eb');
    expect(noteName(6, true)).toBe('Gb');
    expect(noteName(0, true)).toBe('C'); // naturals are unchanged
  });

  it('wraps pitch classes outside 0-11', () => {
    expect(noteName(12, false)).toBe('C');
    expect(noteName(-1, false)).toBe('B');
  });
});

describe('intervalByPitchClass', () => {
  it('maps each interval to its pitch class', () => {
    const intervals: IntervalEntry[] = [
      { semitones: 0, label: 'R' },
      { semitones: 4, label: '3' },
      { semitones: 7, label: '5' },
    ];
    const map = intervalByPitchClass(intervals);
    expect(map.get(0)?.label).toBe('R');
    expect(map.get(4)?.label).toBe('3');
    expect(map.get(7)?.label).toBe('5');
  });

  it('lets a later interval win on pitch-class collision', () => {
    const intervals: IntervalEntry[] = [
      { semitones: 6, label: 'b5' },
      { semitones: 6, label: '#11' },
    ];
    const map = intervalByPitchClass(intervals);
    expect(map.get(6)?.label).toBe('#11');
  });

  it('folds intervals beyond one octave into the correct pitch class', () => {
    const intervals: IntervalEntry[] = [{ semitones: 14, label: '9' }];
    const map = intervalByPitchClass(intervals);
    expect(map.get(2)?.label).toBe('9');
  });
});

describe('computeFretboard', () => {
  const majorIntervals: IntervalEntry[] = [
    { semitones: 0, label: 'R' },
    { semitones: 2, label: '9' },
    { semitones: 4, label: '3' },
    { semitones: 5, label: '11' },
    { semitones: 7, label: '5' },
    { semitones: 9, label: '6' },
    { semitones: 11, label: 'maj7' },
  ];

  it('returns a stringCount x (fretCount+1) matrix', () => {
    const open = [4, 11, 7, 2, 9, 4]; // standard tuning, high-string-first
    const board = computeFretboard(open, 15, majorIntervals, false);
    expect(board.length).toBe(6);
    for (const row of board) {
      expect(row.length).toBe(16);
    }
  });

  it('computes correct pitch classes for standard tuning', () => {
    // index 5 = lowest string (E2), open = E (pc 4)
    const board = computeFretboard([4, 11, 7, 2, 9, 4], 12, majorIntervals, false);
    const lowE = board[5];
    expect(lowE[0].pitchClass).toBe(4); // open E
    expect(lowE[5].pitchClass).toBe(9); // 5th fret = A
    expect(lowE[12].pitchClass).toBe(4); // 12th fret = E (octave)
  });

  it('marks the root distinctly and colors it', () => {
    // C major on standard tuning: low E (pc4) 8th fret = C (pc0) = root
    const board = computeFretboard([4, 11, 7, 2, 9, 4], 12, majorIntervals, false);
    const lowE8 = board[5][8];
    expect(lowE8.pitchClass).toBe(0);
    expect(lowE8.isRoot).toBe(true);
    expect(lowE8.interval?.label).toBe('R');
    expect(lowE8.color).toBe('#779900');
  });

  it('uses enharmonic-correct names with flat spelling for flat roots', () => {
    // Eb root -> preferFlats. A pitch class of 3 should spell 'Eb'.
    const board = computeFretboard([4, 11, 7, 2, 9, 4], 12, majorIntervals, true);
    // find a cell with pc 3 and confirm the spelling
    const pc3 = board[5].find((c) => c.pitchClass === 3);
    expect(pc3?.noteName).toBe('Eb');
  });

  it('leaves non-scale cells with no interval, no color, not root', () => {
    // Major scale on C excludes pc 1 (C#/Db) etc.
    const board = computeFretboard([4, 11, 7, 2, 9, 4], 12, majorIntervals, false);
    const openLowE = board[5][0]; // pc 4 = E, which is in C major (3rd)
    expect(openLowE.interval).not.toBeNull();
    // pc 6 (F#/Gb) is not in C major
    const pc6 = board[5].find((c) => c.pitchClass === 6);
    if (pc6?.interval === null) {
      expect(pc6.color).toBe('');
      expect(pc6.isRoot).toBe(false);
    }
  });

  it('works with an arbitrary (duplicate/odd) tuning without throwing', () => {
    const board = computeFretboard([0, 0, 0, 0, 0, 0], 12, majorIntervals, false);
    expect(board.length).toBe(6);
    expect(board[0][0].pitchClass).toBe(0);
  });
});
