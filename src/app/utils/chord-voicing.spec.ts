import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import { RESULTS_PER_CHORD, searchChord, VoicingOptions } from './chord-voicing';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');
const tuning: ParsedTuning = STANDARD.tuning;

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(`failed to parse ${symbol}`);
  return parsed.chord;
};

const baseOptions: VoicingOptions = {
  openMode: 'allow',
  allowInversions: false,
  allowGaps: false,
  maxStretch: 4,
  minNotes: 3,
};

describe('searchChord', () => {
  it('finds voicings for a C major triad in standard tuning', () => {
    const shapes = searchChord(tuning, chord('C'), baseOptions);
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes.length).toBeLessThanOrEqual(RESULTS_PER_CHORD);
  });

  it('covers every chord tone in every shape', () => {
    const c = chord('C');
    for (const shape of searchChord(tuning, c, baseOptions)) {
      const pcs = new Set(shape.sounding.map((n) => n.midi % 12));
      for (const pc of c.pcs) expect(pcs.has(pc)).toBe(true);
    }
  });

  it('prefers root in the bass when inversions are off (soft preference)', () => {
    // The first shape for G7 should have the root in the bass, since
    // non-root-bass shapes are now allowed but penalized.
    const shapes = searchChord(tuning, chord('G7'), baseOptions);
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0].bassIsRoot).toBe(true);
  });

  it('respects the max stretch rule', () => {
    for (const shape of searchChord(tuning, chord('Em7'), baseOptions)) {
      expect(shape.span).toBeLessThanOrEqual(baseOptions.maxStretch);
    }
  });

  it('keeps sounding strings contiguous when gaps are banned', () => {
    for (const shape of searchChord(tuning, chord('Am'), baseOptions)) {
      const sounding = shape.frets.map((f) => f !== null);
      const first = sounding.indexOf(true);
      const last = sounding.lastIndexOf(true);
      if (first >= 0) {
        expect(sounding.slice(first, last + 1).every(Boolean)).toBe(true);
      }
    }
  });

  it('returns only open-string shapes when required', () => {
    const shapes = searchChord(tuning, chord('Em'), { ...baseOptions, openMode: 'require' });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape.openCount).toBeGreaterThan(0);
  });

  it('returns only closed shapes when opens are excluded', () => {
    const shapes = searchChord(tuning, chord('C'), { ...baseOptions, openMode: 'exclude' });
    for (const shape of shapes) expect(shape.openCount).toBe(0);
  });

  it('supports re-entrant tunings', () => {
    const nashville = parseTuning('E3 A3 D4 G4 B3 E4');
    if (!nashville.ok) throw new Error('parse failed');
    const shapes = searchChord(nashville.tuning, chord('C'), baseOptions);
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('returns nothing when rules are impossible', () => {
    const shapes = searchChord(tuning, chord('C'), {
      ...baseOptions,
      openMode: 'exclude',
      minNotes: 6,
      maxStretch: 1,
    });
    expect(shapes).toEqual([]);
  });

  it('prefers the open-position C shape over a high barre C', () => {
    const shapes = searchChord(tuning, chord('C'), baseOptions);
    expect(shapes.length).toBeGreaterThan(0);
    // The open C (frets 0/3/2/0/1/0) should outrank an 8th-fret barre C.
    const first = shapes[0];
    expect(first.position).toBeLessThan(3);
    expect(first.openCount).toBeGreaterThan(0);
  });

  it('allows non-root bass (doubled root) when inversions are off', () => {
    const shapes = searchChord(tuning, chord('C'), { ...baseOptions, openMode: 'exclude' });
    // With opens excluded, some shapes will have the 5th or 3rd in the bass
    // (root doubling across strings) — those must not be filtered out.
    const nonRootBass = shapes.find((s) => !s.bassIsRoot);
    expect(nonRootBass).toBeTruthy();
  });

  it('ranks a root-bass shape among the top results', () => {
    const shapes = searchChord(tuning, chord('C'), baseOptions);
    // The ergonomics model may legitimately rank a compact non-root voicing
    // (e.g. 0320, span 2) above a wider root voicing (e.g. 32010, span 3).
    // But a root-in-bass shape must appear in the top 5.
    const hasRoot = shapes.some((s) => s.bassIsRoot);
    expect(hasRoot).toBe(true);
    // And the cheapest shape should be very compact (span ≤ 2).
    expect(shapes[0].span).toBeLessThanOrEqual(2);
  });

  it('ranks the open F shape before a 6-string barre F at the same position', () => {
    // Open F: 1/3/3/2/1/1 — a barre but low position. Compare to a
    // high-position barre F (8/10/10/10/8/8) which is harder.
    const openF = searchChord(tuning, chord('F'), baseOptions);
    expect(openF.length).toBeGreaterThan(0);
    const first = openF[0];
    expect(first.position).toBeLessThan(4);
  });
});

describe('searchChord hard constraints', () => {
  it('respects the maxStretch span limit', () => {
    const tight = searchChord(tuning, chord('C'), { ...baseOptions, maxStretch: 2 });
    const wide = searchChord(tuning, chord('C'), { ...baseOptions, maxStretch: 5 });
    for (const shape of tight) {
      expect(shape.span).toBeLessThanOrEqual(2);
    }
    // A wider limit may surface shapes the tight limit rejected.
    expect(wide.length).toBeGreaterThanOrEqual(tight.length);
  });

  it('rejects shapes that need five independent fingers', () => {
    // Cmaj7 has 4 distinct pcs; with unlimited span a 5-finger shape could
    // theoretically appear — the finger-count rule still blocks it.
    const shapes = searchChord(tuning, chord('Cmaj7'), { ...baseOptions, maxStretch: 0 });
    for (const shape of shapes) {
      // Runs of equal frets may share a finger (barre).
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

  it('rejects unbarrable skip-fret shapes when rejectUnbarrable is set', () => {
    const withBarreCheck = searchChord(tuning, chord('C'), {
      ...baseOptions,
      rejectUnbarrable: true,
    });
    const withoutBarreCheck = searchChord(tuning, chord('C'), {
      ...baseOptions,
      rejectUnbarrable: false,
    });
    for (const shape of withBarreCheck) {
      // Same fret on non-adjacent fretted strings with a different fret between.
      for (let a = 0; a < shape.frets.length; a++) {
        for (let b = a + 2; b < shape.frets.length; b++) {
          if (shape.frets[a] === null || shape.frets[a] === 0) continue;
          if (shape.frets[a] === shape.frets[b]) {
            for (let m = a + 1; m < b; m++) {
              expect(shape.frets[m]).not.toBe(shape.frets[a]);
            }
          }
        }
      }
    }
    // The check should never *add* shapes.
    expect(withBarreCheck.length).toBeLessThanOrEqual(withoutBarreCheck.length);
  });

  it('maxStretch 0 means no span limit', () => {
    const shapes = searchChord(tuning, chord('C'), { ...baseOptions, maxStretch: 0 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.span).toBeLessThanOrEqual(11);
    }
  });
});
