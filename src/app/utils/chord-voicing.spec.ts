import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import { RESULTS_PER_CHORD, searchChord } from './chord-voicing';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');
const tuning: ParsedTuning = STANDARD.tuning;

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(`failed to parse ${symbol}`);
  return parsed.chord;
};

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

  it('respects the biomechanical span (≤4 or thumb reach)', () => {
    for (const shape of searchChord(tuning, chord('Em7'))) {
      expect(shape.span).toBeLessThanOrEqual(4);
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

  it('voices extended chords by covering required tones, with optional tones ringable', () => {
    const c13 = chord('C13');
    const requiredPcs = [0, 4, 7, 10, 2];
    const shapes = searchChord(tuning, c13);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of requiredPcs) expect(pcs.has(pc)).toBe(true);
    }
  });

  it('rejects shapes that need five independent fingers', () => {
    const shapes = searchChord(tuning, chord('Cmaj7'));
    for (const shape of shapes) {
      let runs = 0;
      let prevFret: number | null = null;
      for (const fret of shape.frets) {
        if (fret === null || fret === 0) {
          prevFret = null;
          continue;
        }
        if (fret !== prevFret) runs++;
        prevFret = fret;
      }
      expect(runs).toBeLessThanOrEqual(4);
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
    expect(top2.some((s) => JSON.stringify(s.frets) === JSON.stringify([3, 2, 0, 0, 0, 3]))).toBe(true);
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

  it('covers required pcs for C13 in top 2', () => {
    const shapes = searchChord(tuning, chord('C13'));
    const required = [0, 4, 7, 10, 2];
    for (const shape of shapes.slice(0, 2)) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of required) expect(pcs.has(pc)).toBe(true);
    }
  });
});
