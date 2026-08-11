import { describe, expect, it } from 'vitest';

import { parseTuning } from './chord-theory';
import {
  DIRECT_MAX_FRET,
  directPlayabilityWarning,
  parseDirectInput,
  tokenizeDirectInput,
} from './direct-input';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');
const tuning = STANDARD.tuning;

describe('tokenizeDirectInput', () => {
  it('splits on whitespace and commas', () => {
    expect(tokenizeDirectInput('x 3 2 0 1 0')).toEqual(['x', '3', '2', '0', '1', '0']);
    expect(tokenizeDirectInput('3,2,0')).toEqual(['3', '2', '0']);
  });

  it('tokenizes a compact string digit by digit', () => {
    expect(tokenizeDirectInput('x32010')).toEqual(['x', '3', '2', '0', '1', '0']);
  });

  it('returns empty for blank input', () => {
    expect(tokenizeDirectInput('')).toEqual([]);
    expect(tokenizeDirectInput('   ')).toEqual([]);
  });
});

describe('parseDirectInput', () => {
  it('parses "x 3 2 0 1 0" into the correct frets array and shape', () => {
    const result = parseDirectInput('x 3 2 0 1 0', tuning);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frets).toEqual([null, 3, 2, 0, 1, 0]);
    // Standard tuning midi: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.
    expect(result.shape.sounding).toEqual([
      { stringIndex: 1, fret: 3, midi: 48 },
      { stringIndex: 2, fret: 2, midi: 52 },
      { stringIndex: 3, fret: 0, midi: 55 },
      { stringIndex: 4, fret: 1, midi: 60 },
      { stringIndex: 5, fret: 0, midi: 64 },
    ]);
    expect(result.shape.span).toBe(2);
    expect(result.shape.position).toBe(1);
    expect(result.shape.openCount).toBe(2);
    // The open C major shape: the lowest string is muted, so the bass is
    // C (48, A-string fret 3) — the root. The bass note is the *sounding* low.
    expect(result.shape.bassMidi).toBe(48);
    expect(result.shape.bassIsRoot).toBe(true);
    // Sounding notes are C E G C E — a recognizable C major chord.
    expect(result.inferredChord?.symbol).toBe('C');
  });

  it('parses compact "x32010" (no spaces) to the same result', () => {
    const spaced = parseDirectInput('x 3 2 0 1 0', tuning);
    const compact = parseDirectInput('x32010', tuning);
    expect(compact.ok).toBe(true);
    if (!compact.ok || !spaced.ok) return;
    expect(compact.frets).toEqual(spaced.frets);
    expect(compact.shape.sounding).toEqual(spaced.shape.sounding);
    expect(compact.inferredChord?.symbol).toBe(spaced.inferredChord?.symbol);
  });

  it('accepts uppercase X and dashes as mutes', () => {
    const result = parseDirectInput('X - 2 0 1 0', tuning);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frets).toEqual([null, null, 2, 0, 1, 0]);
  });

  it('reports a wrong string count', () => {
    const result = parseDirectInput('x 3 2 0 1', tuning);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('expected 6 strings, got 5');
  });

  it('rejects an all-muted shape', () => {
    const result = parseDirectInput('x x x x x x', tuning);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('empty');
  });

  it('rejects out-of-range frets', () => {
    const result = parseDirectInput(`x 3 2 ${DIRECT_MAX_FRET + 1} 1 0`, tuning);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('is not a fret');
  });

  it('rejects non-numeric tokens', () => {
    const result = parseDirectInput('x 3 2 o 1 0', tuning);
    expect(result.ok).toBe(false);
  });

  it('returns null inferred chord for unrecognizable tone stacks', () => {
    // Random chromatic cluster that parses as a valid shape but no named chord.
    const result = parseDirectInput('1 4 6 9 11 2', tuning);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inferredChord).toBeNull();
  });
});

describe('directPlayabilityWarning', () => {
  it('returns null for a playable shape', () => {
    const result = parseDirectInput('x 3 2 0 1 0', tuning);
    if (!result.ok) throw new Error('parse failed');
    expect(directPlayabilityWarning(result.shape)).toBeNull();
  });

  it('warns about a shape spanning more than 4 frets', () => {
    const result = parseDirectInput('x 7 9 8 7 10', tuning);
    if (!result.ok) throw new Error('parse failed');
    const warning = directPlayabilityWarning(result.shape);
    expect(warning).toContain('spans 3 frets');
    expect(warning).toContain('sure');
  });
});
