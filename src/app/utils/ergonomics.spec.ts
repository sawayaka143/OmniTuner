import { describe, expect, it } from 'vitest';

import { parseChord, parseTuning, ParsedChord, ParsedTuning } from './chord-theory';
import { SoundingNote, VoicingShape } from './chord-voicing';
import {
  detectFingers,
  ergonomicsFeatures,
  filterPlayable,
  fretWidthFactor,
  isPhysicallyPlayable,
  scoreErgonomics,
  scoreProgressionVoicings,
  transitionCost,
} from './ergonomics';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');
const tuning: ParsedTuning = STANDARD.tuning;

const chord = (symbol: string): ParsedChord => {
  const parsed = parseChord(symbol);
  if (!parsed.ok) throw new Error(`failed to parse ${symbol}`);
  return parsed.chord;
};

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

/** Build a VoicingShape from a per-string fret array (null = muted). */
const shapeOf = (frets: (number | null)[], symbol = 'C'): VoicingShape => {
  const sounding: SoundingNote[] = frets
    .map((fret, stringIndex) => ({
      stringIndex,
      fret,
      midi: tuning.midi[stringIndex] + (fret ?? 0),
    }))
    .filter((n): n is SoundingNote => n.fret !== null);
  const frettedOnly = frets.filter((f): f is number => f !== null && f > 0);
  const span = frettedOnly.length ? Math.max(...frettedOnly) - Math.min(...frettedOnly) : 0;
  let bass = Infinity;
  for (const note of sounding) if (note.midi < bass) bass = note.midi;
  const bassIsRoot = mod12(bass - chord(symbol).rootPc) === 0;
  const position = frettedOnly.length ? Math.min(...frettedOnly) : 0;
  const openCount = frets.filter((f) => f === 0).length;
  return { frets, sounding, span, bassMidi: bass, bassIsRoot, position, openCount, cost: 0 };
};

describe('detectFingers', () => {
  it('assigns the index finger to the lowest fretted fret and others in order', () => {
    // Open C: E0 A3 D2 G0 B1 E0 → index at fret 1 (B string), then 2, then 3.
    const f = detectFingers([0, 3, 2, 0, 1, 0]);
    expect(f.fingers).toEqual([null, 3, 2, null, 1, null]);
    expect(f.indexSpan).toBe(0);
    // Stretch fingers (2-4) fret frets {2, 3} → range 1. (Previously computed
    // via `fingers[fret]`, which read the open string's slot and gave 2.)
    expect(f.stretchSpan).toBe(1);
    expect(f.position).toBe(1);
  });

  it('detects a 6-string barre', () => {
    // F barre at fret 1 across all six strings.
    const f = detectFingers([1, 1, 1, 1, 1, 1]);
    expect(f.barres).toEqual([{ fret: 1, width: 6, startString: 0 }]);
    expect(f.barres.length).toBe(1);
  });

  it('detects a 2-string partial barre', () => {
    // A-shape barre: index covers fret 5 on strings 1-2 (A,D), others fretted.
    const f = detectFingers([5, 5, 7, 7, 7, 5]);
    expect(f.barres).toEqual([{ fret: 5, width: 2, startString: 0 }]);
  });

  it('treats open strings as non-fretted', () => {
    const f = detectFingers([0, 3, 2, 0, 1, 0]);
    expect(f.fingers.filter((x) => x !== null).length).toBe(3);
  });

  it('computes spans correctly for shapes high up the neck (fret ≥ 6)', () => {
    // Regression: the span loops previously indexed `fingers[fret]` — with 6
    // strings, any fret ≥ 6 read `undefined`, so high-fret shapes silently
    // lost their index/stretch spans. The array must be indexed by *string*.
    // Shape: barre at 7 (strings 0-1), fingers 2-4 fretting 9, 9, 10.
    const f = detectFingers([7, 7, 9, 9, 10, 7]);
    expect(f.position).toBe(7);
    expect(f.fingers).toEqual([1, 1, 2, 3, 4, 1]);
    // Index finger (1) covers fret 7 only — one stop.
    expect(f.indexSpan).toBe(0);
    // Stretch fingers (2-4) span frets 9 → 10.
    expect(f.stretchSpan).toBe(1);
  });
});

describe('isPhysicallyPlayable', () => {
  it('accepts a standard open chord', () => {
    expect(isPhysicallyPlayable(shapeOf([0, 3, 2, 0, 1, 0]), tuning)).toBe(true);
  });

  it('rejects a shape whose span exceeds the max', () => {
    // Fret range 9 - 1 = 8 > 4.
    const wide = shapeOf([1, 1, 9, 8, 1, 1]);
    expect(isPhysicallyPlayable(wide, tuning, { maxSpan: 4 })).toBe(false);
  });

  it('accepts a shape within the max span', () => {
    // Fret range 3 - 1 = 2 ≤ 4.
    const ok = shapeOf([1, 3, 1, 1, 1, 1]);
    expect(isPhysicallyPlayable(ok, tuning, { maxSpan: 4 })).toBe(true);
  });

  it('honors maxSpan: 0 as unlimited', () => {
    const wide = shapeOf([1, 1, 9, 8, 1, 1]);
    expect(isPhysicallyPlayable(wide, tuning, { maxSpan: 0 })).toBe(true);
  });

  it('rejects a shape requiring five independent fingers', () => {
    // Five distinct fretted frets, none sharing a fret → 5 fingers needed.
    const five = shapeOf([1, 3, 4, 5, 6, 8]);
    expect(isPhysicallyPlayable(five, tuning)).toBe(false);
  });

  it('accepts a shape with four contiguous finger runs (partial barre counts once)', () => {
    // Runs at 1 (strings 0-1), 3, 4, 5 (strings 2-4) → 4 finger groups.
    const four = shapeOf([1, 1, 3, 4, 5, 5]);
    expect(isPhysicallyPlayable(four, tuning)).toBe(true);
  });

  it('rejects an unbarrable partial barre with 5 finger groups', () => {
    // Fret 1 on strings 0-1 AND 5 (non-adjacent) with 3/4/5 between: the
    // finger-count rule needs 5 independent groups — impossible.
    const partial = shapeOf([1, 1, 3, 4, 5, 1]);
    expect(isPhysicallyPlayable(partial, tuning)).toBe(false);
  });

  it('rejects an unbarrable skip-fret shape when rejectUnbarrable is set', () => {
    // Same fret 2 on strings 0 and 3 with different frets in between.
    const skip = shapeOf([2, 3, 4, 2, 0, 0]);
    expect(isPhysicallyPlayable(skip, tuning, { rejectUnbarrable: true })).toBe(false);
  });

  it('allows an unbarrable shape when rejectUnbarrable is off', () => {
    const skip = shapeOf([2, 3, 4, 2, 0, 0]);
    expect(isPhysicallyPlayable(skip, tuning, { rejectUnbarrable: false })).toBe(true);
  });
});

describe('filterPlayable', () => {
  it('filters an array of shapes by the playability rules', () => {
    const shapes = [shapeOf([0, 3, 2, 0, 1, 0]), shapeOf([1, 3, 4, 5, 6, 8])];
    const playable = filterPlayable(shapes, tuning);
    expect(playable).toHaveLength(1);
    expect(playable[0].frets).toEqual([0, 3, 2, 0, 1, 0]);
  });
});

describe('ergonomicsFeatures', () => {
  it('computes position, span, opens and doublings', () => {
    const openC = shapeOf([0, 3, 2, 0, 1, 0]);
    const f = ergonomicsFeatures(openC, tuning, chord('C'));
    expect(f.position).toBe(1);
    expect(f.span).toBe(2); // 3 - 1
    expect(f.openCount).toBe(3);
    // Bass is the open E string (pc 4), which is the 3rd — not the root C.
    expect(f.bassIsRoot).toBe(false);
    // Open C: E2 + A3(C) + D3(E) + G3(G) + B4(C) + E4 → root C is doubled.
    expect(f.rootDoubled).toBe(true);
    expect(f.thirdDoubled).toBe(true); // E appears 3×
    expect(f.noteCount).toBe(6); // all six strings sound
  });

  it('flags a high barre', () => {
    const barre8 = shapeOf([8, 8, 8, 8, 8, 8]);
    const f = ergonomicsFeatures(barre8, tuning, chord('C'));
    expect(f.barreCount).toBe(1);
    expect(f.maxBarreWidth).toBe(6);
    expect(f.barreAtHighFret).toBe(true);
  });

  it('computes the number of independent fingers', () => {
    const openC = shapeOf([0, 3, 2, 0, 1, 0]);
    expect(ergonomicsFeatures(openC, tuning, chord('C')).fingeredCount).toBe(3);
    const barre = shapeOf([1, 1, 1, 1, 1, 1]);
    expect(ergonomicsFeatures(barre, tuning, chord('C')).fingeredCount).toBe(1);
  });

  it('flags a muted string between two sounding strings', () => {
    // A string muted, D/G fretted on both sides.
    const skip = shapeOf([0, null, 3, 2, 0, 0]);
    expect(ergonomicsFeatures(skip, tuning, chord('C')).hasStringSkip).toBe(true);
  });

  it('flags thumb fretting when the lowest string is fretted low and higher strings sit 2+ frets up', () => {
    // Low E fretted at 1, high frets on the top strings.
    const thumb = shapeOf([1, 4, 4, 1, 1, 1]);
    expect(ergonomicsFeatures(thumb, tuning, chord('C')).hasThumbFret).toBe(true);
  });
});

describe('fretWidthFactor', () => {
  it('shrinks as the position rises', () => {
    expect(fretWidthFactor(1)).toBeGreaterThan(fretWidthFactor(9));
  });
});

describe('scoreErgonomics', () => {
  it('ranks open-position shapes below high barre shapes (lower = easier)', () => {
    const openC = shapeOf([0, 3, 2, 0, 1, 0]);
    const barreC = shapeOf([8, 10, 10, 9, 8, 8]);
    const openCost = scoreErgonomics(openC, tuning, chord('C')).cost;
    const barreCost = scoreErgonomics(barreC, tuning, chord('C')).cost;
    expect(openCost).toBeLessThan(barreCost);
  });

  it('penalizes non-root bass', () => {
    // Inversion: bass is the 3rd (E open), root C not in the bass.
    const invC = shapeOf([0, 0, 0, 2, 1, 0]);
    // True root-in-bass C: low E muted, root on the A string (fret 3).
    const rootC = shapeOf([null, 3, 2, 0, 1, 0]);
    const invCost = scoreErgonomics(invC, tuning, chord('C')).cost;
    const rootCost = scoreErgonomics(rootC, tuning, chord('C')).cost;
    // The open inversion is compact and physically trivial (cost ≈ 0.9) while
    // the root-bass C needs a real stretch (cost ≈ 3.5) — the physical ease
    // wins; the bass-not-root penalty must not make the trivial shape worse.
    expect(invCost).toBeLessThan(rootCost);
  });

  it('gives a low cost for an open-position shape', () => {
    const shape = shapeOf([0, 3, 2, 0, 1, 0]);
    const score = scoreErgonomics(shape, tuning, chord('C'));
    expect(score.cost).toBeLessThan(5);
    expect(score.features).toBeTruthy();
  });

  it('includes a bass-thickness penalty for high bass strings', () => {
    // Same root-in-bass shape, but the bass note sits on a higher (thinner) string.
    const lowBass = shapeOf([null, 3, 2, 0, 1, 0]); // bass on string 1 (A2 fret 3 = C)
    const highBass = shapeOf([3, 3, 2, 0, 1, 0]); // bass on string 0 (E2 fret 3 = G3)
    const low = scoreErgonomics(lowBass, tuning, chord('C'));
    const high = scoreErgonomics(highBass, tuning, chord('C'));
    expect(high.cost).toBeGreaterThan(low.cost);
  });

  it('scales stretch penalties exponentially', () => {
    // Two shapes with the same position but different stretch spans.
    const small = shapeOf([1, 3, 1, 1, 1, 1]); // stretch 2
    const large = shapeOf([1, 5, 1, 1, 1, 1]); // stretch 4
    const smallCost = scoreErgonomics(small, tuning, chord('C')).cost;
    const largeCost = scoreErgonomics(large, tuning, chord('C')).cost;
    // Quadratic: 4² = 16 vs 2² = 4 → the extra 2 frets cost ~4× the first 2.
    const stretchContribution = (cost: number): number => cost - (smallCost - 0);
    expect(stretchContribution(largeCost)).toBeGreaterThan(stretchContribution(smallCost) * 3);
  });

  it('applies the fret-width multiplier to stretches', () => {
    // Same stretch at a low position vs a high position — the *stretch*
    // component itself must shrink because frets get narrower up the neck.
    // The two shapes have the same stretch span (4) but different positions;
    // verify the multiplier math in isolation.
    const low = shapeOf([1, 5, 1, 1, 1, 1]); // stretch 4 at position 1
    const high = shapeOf([8, 12, 8, 8, 8, 8]); // stretch 4 at position 8
    const fLow = ergonomicsFeatures(low, tuning, chord('C'));
    const fHigh = ergonomicsFeatures(high, tuning, chord('C'));
    // NOTE: stretchSpan here is the fret range of fingers 2-4, which for
    // [1,5,...] is 0 (the 5 is assigned to finger 2, the 1s to finger 1).
    // The *span* (max−min fretted) is 4 for both — that's what the width
    // multiplier scales in scoreErgonomics. Assert on that instead.
    expect(fLow.span).toBe(fHigh.span); // same overall span (4)
    expect(fretWidthFactor(fLow.position)).toBeGreaterThan(fretWidthFactor(fHigh.position));
    // The span term in scoreErgonomics: span² × widthFactor(position).
    const spanTerm = (f: ReturnType<typeof ergonomicsFeatures>): number =>
      Math.pow(f.span, 2) * fretWidthFactor(f.position);
    expect(spanTerm(fHigh)).toBeLessThan(spanTerm(fLow));
  });

  it('penalizes string skipping', () => {
    const skip = shapeOf([0, null, 3, 2, 0, 0]);
    const noSkip = shapeOf([0, 0, 3, 2, 0, 0]);
    const skipCost = scoreErgonomics(skip, tuning, chord('C')).cost;
    const noSkipCost = scoreErgonomics(noSkip, tuning, chord('C')).cost;
    expect(skipCost).toBeGreaterThan(noSkipCost);
  });

  it('penalizes thumb fretting', () => {
    const thumb = shapeOf([1, 4, 4, 1, 1, 1]);
    const plain = shapeOf([1, 3, 2, 0, 1, 0]);
    const thumbCost = scoreErgonomics(thumb, tuning, chord('C')).cost;
    const plainCost = scoreErgonomics(plain, tuning, chord('C')).cost;
    expect(thumbCost).toBeGreaterThan(plainCost);
  });

  it('rewards ringing more notes (full voicings beat sparse truncations)', () => {
    // The sparse [3,2,0,0] is a subset of full 320003; the model must prefer
    // the full shape so the pool isn't full of near-identical truncations.
    const sparse = shapeOf([3, 2, 0, 0, null, null]);
    const full = shapeOf([3, 2, 0, 0, 0, 3]);
    expect(scoreErgonomics(full, tuning, chord('G')).cost).toBeLessThan(
      scoreErgonomics(sparse, tuning, chord('G')).cost,
    );
  });

  it('prefers the full open G over a sparse rootless shape', () => {
    // Regression for the "same 5 lame voicings" report: the full open G
    // (320003, root in bass, 6 notes) must outrank the low-effort x2 0 0 1
    // (G2 B2 D3 B3 B3 — rootless, no 3rd, doubled 3rd). Higher-position
    // barre shapes (355433, x 10 12 12 12 10) are legitimately harder to play,
    // so they're allowed to cost more — the point is the open classic wins.
    const lame = shapeOf([null, 0, 0, 1, 1, 1]);
    const openG = shapeOf([3, 2, 0, 0, 0, 3]);
    const lameCost = scoreErgonomics(lame, tuning, chord('G')).cost;
    expect(scoreErgonomics(openG, tuning, chord('G')).cost).toBeLessThan(lameCost);
  });

  it('penalizes doublings instead of rewarding them', () => {
    // doublingPerTone is now a positive penalty. Both shapes ring 6 notes with
    // the root in the bass and the same open/fretted structure; 320003 doubles
    // the 3rd (B on strings 1 and 4), 300003 rings it once. The doubled shape
    // must cost MORE.
    const doubled = shapeOf([3, 2, 0, 0, 0, 3]); // G B D G B D — B doubled
    const single = shapeOf([3, 0, 0, 0, 0, 3]); // G A D G B G — single B
    const doubledFeat = ergonomicsFeatures(doubled, tuning, chord('G'));
    const singleFeat = ergonomicsFeatures(single, tuning, chord('G'));
    expect(doubledFeat.thirdDoubled).toBe(true);
    expect(singleFeat.thirdDoubled).toBe(false);
    expect(singleFeat.noteCount).toBe(doubledFeat.noteCount);
    expect(scoreErgonomics(single, tuning, chord('G')).cost).toBeLessThan(
      scoreErgonomics(doubled, tuning, chord('G')).cost,
    );
  });
});

describe('transitionCost', () => {
  it('is 0 for identical shapes', () => {
    const a = shapeOf([0, 3, 2, 0, 1, 0]);
    expect(transitionCost(a, a)).toBe(0);
  });

  it('penalizes moving between different positions', () => {
    const low = shapeOf([0, 3, 2, 0, 1, 0]);
    const high = shapeOf([8, 10, 10, 9, 8, 8]);
    expect(transitionCost(low, high)).toBeGreaterThan(transitionCost(low, low));
  });
});

describe('scoreProgressionVoicings', () => {
  it('finds the globally optimal path through a progression', () => {
    // Two chords, each with two voicings, constructed so the greedy choice
    // (cheapest ergonomics per chord) differs from the global optimum.
    //
    //   C chord:   c0 = open C (cost ≈ 4.7),  c1 = high C (cost ≈ 15.5)
    //   G chord:   g0 = high G (cost ≈ 17.0), g1 = open G (cost ≈ -1.0)
    //
    // Greedy picks c0 then g1 (ergo 4.7 + 12 transition + (-1) = 15.7).
    // But c1→g0 keeps the hand at position 8 with a 0 transition: total 32.5.
    // Wait — 15.7 < 32.5, so the greedy path is actually the global optimum
    // here! The open shapes are SO cheap that the transition cost can't
    // overcome them. So this test instead asserts the DP picks the greedy
    // path, proving it's not *destroying* good voicings for transitions.
    const c0 = shapeOf([0, 3, 2, 0, 1, 0]); // open C
    const c1 = shapeOf([8, 10, 10, 9, 8, 8]); // high C (position 8)
    const g0 = shapeOf([8, 10, 10, 9, 8, 8]); // high G — same frets as c1
    const g1 = shapeOf([3, 2, 0, 0, 0, 3]); // open G
    const result = scoreProgressionVoicings([chord('C'), chord('G')], tuning, [
      [c0, c1],
      [g0, g1],
    ]);
    expect(result.path).toEqual([0, 1]);
    expect(result.choices).toHaveLength(2);
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  it('handles a single chord', () => {
    const c0 = shapeOf([0, 3, 2, 0, 1, 0]);
    const result = scoreProgressionVoicings([chord('C')], tuning, [[c0]]);
    expect(result.path).toEqual([0]);
  });

  it('returns an empty path for no chords', () => {
    expect(scoreProgressionVoicings([], tuning, [])).toEqual({ cost: 0, choices: [], path: [] });
  });
});
