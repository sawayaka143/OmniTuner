import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import {
  requiredExtensionChoices,
  requiredPitchClasses,
  RESULTS_PER_CHORD,
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

  it('keeps guide tones and altered fifths, moving extensions to the any-of set', () => {
    const c13 = chord('C13');
    const required = requiredPitchClasses(c13);
    for (const pc of [0, 4, 10]) expect(required.has(pc)).toBe(true);
    expect(required.has(7)).toBe(false);
    expect(required.has(2)).toBe(false);

    const extensions = requiredExtensionChoices(c13);
    expect(extensions).toContain(2);
    expect(extensions).toContain(5);
    expect(extensions).toContain(9);

    const altered = requiredPitchClasses(chord('C7#5'));
    expect(altered.has(8)).toBe(true);
    expect(altered.has(7)).toBe(false);
  });

  it('has no extension choices for chords without tension tones', () => {
    for (const symbol of ['C', 'Cm', 'Caug', 'C7', 'Cmaj7']) {
      expect(requiredExtensionChoices(chord(symbol)), symbol).toHaveLength(0);
    }
  });
});

describe('canonical shapes (standard tuning)', () => {
  const CANONICAL: readonly { symbol: string; frets: (number | null)[]; maxRank: number }[] = [
    { symbol: 'C', frets: [null, 3, 2, 0, 1, 0], maxRank: 2 },
    { symbol: 'G', frets: [3, 2, 0, 0, 0, 3], maxRank: 2 },
    { symbol: 'Am', frets: [null, 0, 2, 2, 1, 0], maxRank: 2 },
    { symbol: 'Bb', frets: [null, 1, 0, 3, 3, 1], maxRank: 2 },
    { symbol: 'Cmaj7', frets: [null, 3, 2, 0, 0, null], maxRank: 3 },
    { symbol: 'Cmaj7', frets: [null, 3, 2, 0, 0, 0], maxRank: 2 },
    { symbol: 'Ebmaj7', frets: [null, null, 1, 3, 3, 3], maxRank: 2 },
    { symbol: 'Cmaj9', frets: [null, 3, 2, 4, 3, null], maxRank: 3 },
    { symbol: 'Caug', frets: [null, 3, 2, 1, 1, 0], maxRank: 2 },
    { symbol: 'Cm9', frets: [null, 3, 1, 3, 3, null], maxRank: 1 },
    { symbol: 'Dm9', frets: [null, 5, 3, 5, 5, null], maxRank: 2 },
    { symbol: 'Cadd9', frets: [null, 3, 2, 0, 3, 0], maxRank: 5 },
    { symbol: 'C7', frets: [null, 3, 2, 3, 1, null], maxRank: 4 },
    { symbol: 'C13', frets: [null, 3, 2, 3, 3, null], maxRank: 1 },
    { symbol: 'Em7', frets: [0, 2, 0, 0, 0, 0], maxRank: 2 },
    // Movable barre forms: the standard shapes for these chords in any key.
    { symbol: 'Eb', frets: [null, 6, 8, 8, 8, 6], maxRank: 2 },
    { symbol: 'F#maj7', frets: [2, null, 3, 3, 2, null], maxRank: 2 },
    { symbol: 'Gmaj7', frets: [3, null, 4, 4, 3, null], maxRank: 3 },
    { symbol: 'B7b13', frets: [7, null, 7, 8, 8, null], maxRank: 2 },
  ];

  it.each(CANONICAL)(
    'ranks $symbol $frets within the top $maxRank',
    ({ symbol, frets, maxRank }) => {
      const label = `${symbol} ${JSON.stringify(frets)}`;
      const shapes = searchChord(tuning, chord(symbol));
      const index = shapes.findIndex((s) => JSON.stringify(s.frets) === JSON.stringify(frets));
      expect(index, `${label} not found among ${shapes.length} shapes`).toBeGreaterThanOrEqual(0);
      expect(index + 1, label).toBeLessThanOrEqual(maxRank);
    },
  );
});

describe('searchChord (biomechanical engine)', () => {
  it('finds voicings for a C major triad in standard tuning', () => {
    const shapes = searchChord(tuning, chord('C'));
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.length).toBeLessThanOrEqual(RESULTS_PER_CHORD);
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

  it('voices extended chords with the guide tones plus at least one tension', () => {
    const c13 = chord('C13');
    const guideTones = [0, 4, 10];
    const tensions = [2, 5, 9];
    const shapes = searchChord(tuning, c13);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of guideTones) expect(pcs.has(pc)).toBe(true);
      expect(
        tensions.some((pc) => pcs.has(pc)),
        JSON.stringify(shape.frets),
      ).toBe(true);
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

  it('rejects shapes that need five independent fingers', () => {
    const shapes = searchChord(tuning, chord('Cmaj7'));
    for (const shape of shapes) {
      let runs = 0;
      let prevFret: number | null = null;
      for (const fret of shape.frets) {
        if (fret === 0) {
          prevFret = null;
          continue;
        }
        if (fret === null) continue;
        if (fret !== prevFret) runs++;
        prevFret = fret;
      }
      expect(runs, JSON.stringify(shape.frets)).toBeLessThanOrEqual(4);
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
    // No C voicing can reach a D below the root within the fret window.
    const shapes = searchChord(tuning, chord('C/D'));
    expect(shapes.length).toBeGreaterThan(0);
    const constrained = searchChord(tuning, chord('Am/G'));
    expect(constrained.length).toBeGreaterThan(0);
    for (const shape of constrained) {
      expect(shape.frets[0], JSON.stringify(shape.frets)).toBe(3);
    }
  });
});

describe('ranking regression (biomechanical)', () => {
  it('ranks open C in top 2', () => {
    const shapes = searchChord(tuning, chord('C'));
    const top2 = shapes.slice(0, 2);
    const canonicalMuted = JSON.stringify([null, 3, 2, 0, 1, 0]);
    expect(top2.some((s) => JSON.stringify(s.frets) === canonicalMuted)).toBe(true);
  });

  it('ranks open G [320003] in top 2', () => {
    const shapes = searchChord(tuning, chord('G'));
    const top2 = shapes.slice(0, 2);
    expect(top2.some((s) => JSON.stringify(s.frets) === JSON.stringify([3, 2, 0, 0, 0, 3]))).toBe(
      true,
    );
  });

  it('ranks open Am [x02210] in top 2', () => {
    const shapes = searchChord(tuning, chord('Am'));
    const top2 = shapes.slice(0, 2);
    const a = JSON.stringify([0, 0, 2, 2, 1, 0]);
    const b = JSON.stringify([null, 0, 2, 2, 1, 0]);
    expect(
      top2.some((s) => {
        const f = JSON.stringify(s.frets);
        return f === a || f === b;
      }),
    ).toBe(true);
  });

  it('covers guide tones for C13 in top 2', () => {
    const shapes = searchChord(tuning, chord('C13'));
    const guideTones = [0, 4, 10];
    const tensions = [2, 5, 9];
    for (const shape of shapes.slice(0, 2)) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of guideTones) expect(pcs.has(pc)).toBe(true);
      expect(
        tensions.some((pc) => pcs.has(pc)),
        JSON.stringify(shape.frets),
      ).toBe(true);
    }
  });
});
