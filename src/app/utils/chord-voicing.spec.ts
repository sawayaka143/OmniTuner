import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import { DEFAULT_VOICING_COUNT, MAX_VOICING_COUNT } from '../data/chord-voicing.constants';
import {
  analyseFingering,
  handFits,
  isNarrowingOf,
  requiredExtensions,
  requiredPitchClasses,
  searchChord,
} from './chord-voicing';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');
const tuning: ParsedTuning = STANDARD.tuning;

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(`failed to parse ${symbol}`);
  return parsed.chord;
};

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

describe('requiredPitchClasses', () => {
  it('drops the natural fifth once a third and a seventh or sixth are present', () => {
    for (const symbol of [
      'Cmaj7',
      'Cm7',
      'C7',
      'Cm9',
      'Cmaj9',
      'Cm11',
      'CmMaj7',
      'C6',
      'Cm6',
      'C6/9',
      'Cmaj7#11',
    ]) {
      const parsed = chord(symbol);
      expect(parsed.intervals.includes(7), symbol).toBe(true);
      expect(requiredPitchClasses(parsed).has(mod12(parsed.rootPc + 7)), symbol).toBe(false);
    }
  });

  it('keeps the natural fifth when there is no third or no seventh/sixth', () => {
    for (const symbol of [
      'C',
      'Cm',
      'Cadd9',
      'Cmadd9',
      'Csus2',
      'Csus4',
      'C7sus2',
      'C7sus4',
      'C5',
    ]) {
      const parsed = chord(symbol);
      expect(parsed.intervals.includes(7), symbol).toBe(true);
      expect(requiredPitchClasses(parsed).has(mod12(parsed.rootPc + 7)), symbol).toBe(true);
    }
  });

  it('keeps guide tones and altered fifths, leaving extensions to requiredExtensions', () => {
    const c13 = chord('C13');
    const required = requiredPitchClasses(c13);
    for (const pc of [0, 4, 10]) expect(required.has(pc)).toBe(true);
    expect(required.has(7)).toBe(false);
    expect(required.has(2)).toBe(false);

    const altered = requiredPitchClasses(chord('C7#5'));
    expect(altered.has(8)).toBe(true);
    expect(altered.has(7)).toBe(false);
  });

  it('has no required extensions for chords without tension tones', () => {
    for (const symbol of ['C', 'Cm', 'Caug', 'C7', 'Cmaj7']) {
      expect(requiredExtensions(chord(symbol)), symbol).toHaveLength(0);
    }
  });
});

describe('requiredExtensions', () => {
  it.each([
    ['C9', [2]],
    ['C11', [5]],
    ['C13', [9]],
    ['Cmaj13', [9]],
    ['Cm11', [5]],
    ['C6/9', [2]],
  ])('requires the highest natural tension of %s', (symbol, expected) => {
    expect([...requiredExtensions(chord(symbol))].sort((a, b) => a - b)).toEqual(expected);
  });

  it.each([
    ['C7b9', [1]],
    ['C7#9', [3]],
    ['C13b9', [1, 9]],
    ['C7#9b13', [3, 8]],
    ['C9#11', [6]],
  ])('requires every altered tension of %s', (symbol, expected) => {
    expect([...requiredExtensions(chord(symbol))].sort((a, b) => a - b)).toEqual(expected);
  });
});

type Frets = (number | null)[];

const fretsOf = (symbol: string, t: ParsedTuning = tuning, count?: number): string[] =>
  searchChord(t, chord(symbol), count).map((shape) => JSON.stringify(shape.frets));

describe('standard grips (standard tuning)', () => {
  const x = null;
  const GRIPS: readonly { symbol: string; frets: Frets; maxRank: number }[] = [
    { symbol: 'C', frets: [x, 3, 2, 0, 1, 0], maxRank: 1 },
    { symbol: 'C', frets: [x, 3, 5, 5, 5, 3], maxRank: 3 },
    { symbol: 'D', frets: [x, x, 0, 2, 3, 2], maxRank: 1 },
    { symbol: 'D', frets: [x, 5, 7, 7, 7, 5], maxRank: 2 },
    { symbol: 'E', frets: [0, 2, 2, 1, 0, 0], maxRank: 1 },
    { symbol: 'F', frets: [1, 3, 3, 2, 1, 1], maxRank: 1 },
    { symbol: 'G', frets: [3, 2, 0, 0, 0, 3], maxRank: 1 },
    { symbol: 'A', frets: [x, 0, 2, 2, 2, 0], maxRank: 1 },
    { symbol: 'A', frets: [5, 7, 7, 6, 5, 5], maxRank: 2 },
    { symbol: 'B', frets: [x, 2, 4, 4, 4, 2], maxRank: 1 },
    { symbol: 'B', frets: [7, 9, 9, 8, 7, 7], maxRank: 2 },
    { symbol: 'Bb', frets: [x, 1, 3, 3, 3, 1], maxRank: 2 },
    { symbol: 'Bb', frets: [x, 1, 0, 3, 3, 1], maxRank: 2 },
    { symbol: 'Eb', frets: [x, 6, 8, 8, 8, 6], maxRank: 2 },
    { symbol: 'Ab', frets: [4, 6, 6, 5, 4, 4], maxRank: 1 },
    { symbol: 'C#', frets: [x, 4, 6, 6, 6, 4], maxRank: 1 },
    { symbol: 'F#', frets: [2, 4, 4, 3, 2, 2], maxRank: 1 },
    { symbol: 'Am', frets: [x, 0, 2, 2, 1, 0], maxRank: 1 },
    { symbol: 'Am', frets: [5, 7, 7, 5, 5, 5], maxRank: 2 },
    { symbol: 'Em', frets: [0, 2, 2, 0, 0, 0], maxRank: 1 },
    { symbol: 'Dm', frets: [x, x, 0, 2, 3, 1], maxRank: 1 },
    { symbol: 'Bm', frets: [x, 2, 4, 4, 3, 2], maxRank: 1 },
    { symbol: 'Bm', frets: [7, 9, 9, 7, 7, 7], maxRank: 2 },
    { symbol: 'C#m', frets: [x, 4, 6, 6, 5, 4], maxRank: 1 },
    { symbol: 'F#m', frets: [2, 4, 4, 2, 2, 2], maxRank: 1 },
    { symbol: 'Fm', frets: [1, 3, 3, 1, 1, 1], maxRank: 1 },
    { symbol: 'Cm', frets: [x, 3, 5, 5, 4, 3], maxRank: 2 },
    { symbol: 'Gm', frets: [3, 5, 5, 3, 3, 3], maxRank: 2 },
    { symbol: 'C7', frets: [x, 3, 2, 3, 1, 0], maxRank: 1 },
    { symbol: 'G7', frets: [3, 2, 0, 0, 0, 1], maxRank: 1 },
    { symbol: 'D7', frets: [x, x, 0, 2, 1, 2], maxRank: 1 },
    { symbol: 'E7', frets: [0, 2, 0, 1, 0, 0], maxRank: 1 },
    { symbol: 'A7', frets: [x, 0, 2, 0, 2, 0], maxRank: 1 },
    { symbol: 'B7', frets: [x, 2, 1, 2, 0, 2], maxRank: 1 },
    { symbol: 'F7', frets: [1, 3, 1, 2, 1, 1], maxRank: 1 },
    { symbol: 'Am7', frets: [x, 0, 2, 0, 1, 0], maxRank: 1 },
    { symbol: 'Em7', frets: [0, 2, 0, 0, 0, 0], maxRank: 1 },
    { symbol: 'Dm7', frets: [x, x, 0, 2, 1, 1], maxRank: 1 },
    { symbol: 'Bm7', frets: [x, 2, 0, 2, 0, 2], maxRank: 1 },
    { symbol: 'Cmaj7', frets: [x, 3, 2, 0, 0, 0], maxRank: 1 },
    { symbol: 'Dmaj7', frets: [x, x, 0, 2, 2, 2], maxRank: 1 },
    { symbol: 'Amaj7', frets: [x, 0, 2, 1, 2, 0], maxRank: 1 },
    { symbol: 'Gmaj7', frets: [3, x, 4, 4, 3, x], maxRank: 3 },
    { symbol: 'F#maj7', frets: [2, x, 3, 3, 2, x], maxRank: 1 },
    { symbol: 'Ebmaj7', frets: [x, x, 1, 3, 3, 3], maxRank: 2 },
    { symbol: 'Dsus4', frets: [x, x, 0, 2, 3, 3], maxRank: 1 },
    { symbol: 'Asus2', frets: [x, 0, 2, 2, 0, 0], maxRank: 1 },
    { symbol: 'Caug', frets: [x, 3, 2, 1, 1, 0], maxRank: 1 },
    { symbol: 'Cadd9', frets: [x, 3, 2, 0, 3, 0], maxRank: 3 },
    { symbol: 'Cmaj9', frets: [x, 3, 2, 4, 3, x], maxRank: 3 },
    { symbol: 'Cm9', frets: [x, 3, 1, 3, 3, x], maxRank: 1 },
    { symbol: 'Dm9', frets: [x, 5, 3, 5, 5, x], maxRank: 1 },
    { symbol: 'B7b13', frets: [7, x, 7, 8, 8, x], maxRank: 2 },
  ];

  it.each(GRIPS)('ranks $symbol $frets within the top $maxRank', ({ symbol, frets, maxRank }) => {
    const label = `${symbol} ${JSON.stringify(frets)}`;
    const ranked = fretsOf(symbol);
    const index = ranked.indexOf(JSON.stringify(frets));
    expect(index, `${label} not found among ${ranked.join(' ')}`).toBeGreaterThanOrEqual(0);
    expect(index + 1, `${label} in ${ranked.join(' ')}`).toBeLessThanOrEqual(maxRank);
  });
});

describe('result selection', () => {
  const SYMBOLS = [
    'C',
    'G',
    'D',
    'A',
    'E',
    'F',
    'B',
    'Bb',
    'Am',
    'Bm',
    'F#m',
    'C7',
    'Cmaj7',
    'Cm9',
  ];

  it.each(SYMBOLS)('never lists %s twice with only strings dropped', (symbol) => {
    const shapes = searchChord(tuning, chord(symbol), MAX_VOICING_COUNT);
    for (const a of shapes) {
      for (const b of shapes) {
        if (a === b) continue;
        expect(isNarrowingOf(a.frets, b.frets), `${a.frets} vs ${b.frets}`).toBe(false);
      }
    }
  });

  it('keeps the full grip and hides the same grip with a string dropped', () => {
    const ranked = fretsOf('G');
    expect(ranked[0]).toBe(JSON.stringify([3, 2, 0, 0, 0, 3]));
    expect(ranked).not.toContain(JSON.stringify([3, 2, 0, 0, 0, null]));
    expect(fretsOf('B')).not.toContain(JSON.stringify([null, 2, null, 4, 4, 2]));
  });

  it('returns the requested number of fingerings', () => {
    expect(searchChord(tuning, chord('C'), 1)).toHaveLength(1);
    expect(searchChord(tuning, chord('C'))).toHaveLength(DEFAULT_VOICING_COUNT);
    expect(searchChord(tuning, chord('C'), MAX_VOICING_COUNT)).toHaveLength(MAX_VOICING_COUNT);
  });

  it('returns a longer list that starts with the shorter one', () => {
    const short = fretsOf('Bm', tuning, 3);
    const long = fretsOf('Bm', tuning, MAX_VOICING_COUNT);
    expect(long.slice(0, 3)).toEqual(short);
  });
});

describe('isNarrowingOf', () => {
  it('matches a shape with strings muted against its full version', () => {
    expect(isNarrowingOf([3, 2, 0, 0, 0, null], [3, 2, 0, 0, 0, 3])).toBe(true);
    expect(isNarrowingOf([3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 0, 3])).toBe(true);
  });

  it('rejects shapes that differ on a sounding string', () => {
    expect(isNarrowingOf([3, 2, 0, 0, 3, 3], [3, 2, 0, 0, 0, 3])).toBe(false);
    expect(isNarrowingOf([3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 0, null])).toBe(false);
  });
});

describe('analyseFingering', () => {
  it('uses one finger per fretted note when four fingers are enough', () => {
    expect(analyseFingering([null, 3, 2, 0, 1, 0])).toEqual({ fingers: 3, barres: 0 });
    expect(analyseFingering([null, 0, 2, 2, 2, 0])).toEqual({ fingers: 3, barres: 0 });
  });

  it('barres a fret when more than four notes are fretted', () => {
    expect(analyseFingering([1, 3, 3, 2, 1, 1])).toEqual({ fingers: 4, barres: 1 });
    expect(analyseFingering([null, 2, 4, 4, 4, 2])).toEqual({ fingers: 3, barres: 1 });
  });

  it('cannot barre across an open string or a lower fret', () => {
    expect(analyseFingering([2, 3, 0, 4, 3, 2])).toBeNull();
  });
});

describe('handFits', () => {
  it('accepts prefixes a hand can hold', () => {
    expect(handFits([1, 3, 3, 2, 1, 1], 6)).toBe(true);
    expect(handFits([5, 5, 5, 5, 5, 5], 6)).toBe(true);
    expect(handFits([3, null, null], 6)).toBe(true);
    expect(handFits([1, 6], 6)).toBe(true);
  });

  it('rejects spans past four frets without the thumb', () => {
    expect(handFits([null, 1, 6], 6)).toBe(false);
  });

  it('rejects prefixes that need five fingers', () => {
    expect(handFits([1, 2, 3, 4, 5], 6)).toBe(false);
  });

  it('rejects a thumb above the hand or too far below it', () => {
    expect(handFits([6, 1], 6)).toBe(false);
    expect(handFits([1, 10], 6)).toBe(false);
  });

  it('rejects a thumb stretch on shapes with fewer than four strings', () => {
    expect(handFits([1, 6], 3)).toBe(false);
  });
});

describe('re-entrant tunings', () => {
  const ukulele = parseTuning('G4 C4 E4 A4');
  if (!ukulele.ok) throw new Error('failed to parse ukulele tuning');
  const ukuleleTuning = ukulele.tuning;

  it.each([
    ['C', [0, 0, 0, 3]],
    ['G', [0, 2, 3, 2]],
    ['F', [2, 0, 1, 0]],
    ['Am', [2, 0, 0, 0]],
    ['D', [2, 2, 2, 0]],
  ])('ranks the standard ukulele %s first', (symbol, frets) => {
    expect(fretsOf(symbol, ukuleleTuning)[0]).toBe(JSON.stringify(frets));
  });
});

describe('searchChord', () => {
  it('finds voicings for a C major triad in standard tuning', () => {
    const shapes = searchChord(tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.length).toBeLessThanOrEqual(DEFAULT_VOICING_COUNT);
  });

  it('covers every required chord tone in every shape', () => {
    const c = chord('C');
    for (const shape of searchChord(tuning, c)) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      const required = c.pcs.filter((pc) => !new Set(c.optionalPcs).has(pc));
      for (const pc of required) expect(pcs.has(pc)).toBe(true);
    }
  });

  it('respects the biomechanical span (<=4, or thumb reach on the low string)', () => {
    const maxSpan = 4;
    const maxThumbReach = 4;
    for (const shape of searchChord(tuning, chord('Em7'))) {
      const frets = JSON.stringify(shape.frets);
      if (shape.span <= maxSpan) continue;
      const [thumb, ...rest] = shape.frets;
      const others = rest.filter((f): f is number => f !== null && f > 0);
      expect(thumb, frets).not.toBeNull();
      expect(thumb!, frets).toBeGreaterThan(0);
      expect(others.length, frets).toBeGreaterThan(0);
      expect(Math.max(...others) - Math.min(...others), frets).toBeLessThanOrEqual(maxSpan);
      expect(thumb!, frets).toBeLessThanOrEqual(Math.min(...others));
      expect(Math.min(...others) - thumb!, frets).toBeLessThanOrEqual(maxThumbReach);
    }
  });

  it('supports re-entrant tunings', () => {
    const nashville = parseTuning('E3 A3 D4 G4 B3 E4');
    if (!nashville.ok) throw new Error('parse failed');
    const shapes = searchChord(nashville.tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('supports 4-string ukulele tuning', () => {
    const uke = parseTuning('G4 C4 E4 A4');
    if (!uke.ok) throw new Error('parse failed');
    const shapes = searchChord(uke.tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('supports 7-string guitar tuning', () => {
    const seven = parseTuning('B1 E2 A2 D3 G3 B3 E4');
    if (!seven.ok) throw new Error('parse failed');
    const shapes = searchChord(seven.tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('searches extended-range tunings', () => {
    const eight = parseTuning('F#1 B1 E2 A2 D3 G3 B3 E4');
    if (!eight.ok) throw new Error('parse failed');
    for (const symbol of ['C', 'Cmaj13', 'C13#11']) {
      expect(searchChord(eight.tuning, chord(symbol)).length, symbol).toBeGreaterThan(0);
    }
  }, 20_000);

  it('keeps every shape on a 12-string tuning within eight adjacent strings', () => {
    const twelve = parseTuning('E1 A1 D2 G2 C3 F3 A#3 D#4 G#4 C#5 F#5 B5');
    if (!twelve.ok) throw new Error('parse failed');
    const shapes = searchChord(twelve.tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const strings = shape.sounding.map((note) => note.stringIndex);
      expect(Math.max(...strings) - Math.min(...strings)).toBeLessThan(8);
    }
  });

  it('never returns more than two muted strings inside a shape', () => {
    for (const symbol of ['C', 'G7', 'Dm7b5', 'E13']) {
      for (const shape of searchChord(tuning, chord(symbol), MAX_VOICING_COUNT)) {
        const strings = shape.sounding.map((note) => note.stringIndex);
        const interior = Math.max(...strings) - Math.min(...strings) + 1 - strings.length;
        expect(interior, JSON.stringify(shape.frets)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('prefers the open-position C shape over a high barre C', () => {
    const shapes = searchChord(tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
    const first = shapes[0];
    expect(first.position).toBeLessThan(3);
    expect(first.openCount).toBeGreaterThan(0);
  });

  it('ranks a root-bass shape among the top results', () => {
    const shapes = searchChord(tuning, chord('C'));
    expect(shapes.some((s) => s.bassIsRoot)).toBe(true);
    expect(shapes[0].span).toBeLessThanOrEqual(2);
  });

  it('produces custom tuning tabs with same tab format', () => {
    const custom = parseTuning('D2 A2 D3 G3 A3 D4');
    if (!custom.ok) throw new Error('parse failed');
    const shapes = searchChord(custom.tuning, chord('G'));
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape.frets.length).toBe(6);
  });

  it('voices a 13 chord with its guide tones and the 13th itself', () => {
    const shapes = searchChord(tuning, chord('C13'), MAX_VOICING_COUNT);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of [0, 4, 10, 9]) expect(pcs.has(pc), JSON.stringify(shape.frets)).toBe(true);
    }
  });

  it('voices two-note power chords instead of pruning every candidate', () => {
    for (const symbol of ['C5', 'G5', 'E5']) {
      const shapes = searchChord(tuning, chord(symbol));
      expect(shapes.length, symbol).toBeGreaterThan(0);
      for (const shape of shapes) {
        const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
        expect(pcs.size, `${symbol} ${JSON.stringify(shape.frets)}`).toBe(2);
      }
    }
  });

  it('only returns shapes four fingers can hold, counting a barre as one finger', () => {
    for (const symbol of ['Cmaj7', 'F', 'Bm', 'C13', 'Ebmaj7']) {
      for (const shape of searchChord(tuning, chord(symbol), MAX_VOICING_COUNT)) {
        const fingering = analyseFingering(shape.frets);
        expect(fingering, `${symbol} ${JSON.stringify(shape.frets)}`).not.toBeNull();
        expect(fingering!.fingers).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('slash chords', () => {
  const bassPc = (shape: { sounding: readonly { midi: number }[] }): number => {
    const midis = shape.sounding.map((n) => n.midi);
    return mod12(Math.min(...midis));
  };

  it.each([
    ['C/E', 4],
    ['C/G', 7],
    ['D/F#', 6],
    ['Am/G', 7],
    ['C#dim/E', 4],
    ['A7#5/C#', 1],
    ['Cmaj7/B', 11],
  ])('puts the requested bass note under %s', (symbol, expected) => {
    const shapes = searchChord(tuning, chord(symbol));
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(bassPc(shape), `${symbol} ${JSON.stringify(shape.frets)}`).toBe(expected);
    }
  });

  it('leaves plain chords unconstrained', () => {
    expect(chord('C').bassPc).toBeUndefined();
    const shapes = searchChord(tuning, chord('C'));
    expect(shapes[0].bassIsRoot).toBe(true);
  });

  it('falls back to unconstrained voicings when the bass is unreachable', () => {
    const shapes = searchChord(tuning, chord('C/D'));
    expect(shapes.length).toBeGreaterThan(0);
    const constrained = searchChord(tuning, chord('Am/G'));
    expect(constrained.length).toBeGreaterThan(0);
    expect(constrained[0].frets[0], JSON.stringify(constrained[0].frets)).toBe(3);
  });
});
