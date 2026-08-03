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

  it('keeps the chord root in the bass when inversions are off', () => {
    for (const shape of searchChord(tuning, chord('G7'), baseOptions)) {
      expect(shape.bassIsRoot).toBe(true);
    }
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
});
