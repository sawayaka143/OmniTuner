import { SCALES } from './scale.constants';

describe('SCALES', () => {
  const expectedDegrees: Readonly<Record<string, readonly string[]>> = {
    major: ['1', '2', '3', '4', '5', '6', '7'],
    'natural-minor': ['1', '2', '♭3', '4', '5', '♭6', '♭7'],
    'harmonic-minor': ['1', '2', '♭3', '4', '5', '♭6', '7'],
    'melodic-minor': ['1', '2', '♭3', '4', '5', '6', '7'],
    dorian: ['1', '2', '♭3', '4', '5', '6', '♭7'],
    phrygian: ['1', '♭2', '♭3', '4', '5', '♭6', '♭7'],
    lydian: ['1', '2', '3', '♯4', '5', '6', '7'],
    mixolydian: ['1', '2', '3', '4', '5', '6', '♭7'],
    locrian: ['1', '♭2', '♭3', '4', '♭5', '♭6', '♭7'],
    'major-pentatonic': ['1', '2', '3', '5', '6'],
    'minor-pentatonic': ['1', '♭3', '4', '5', '♭7'],
    blues: ['1', '♭3', '4', '♭5', '5', '♭7'],
  };

  it('uses scale-degree notation for every scale', () => {
    for (const scale of SCALES) {
      expect(scale.intervals.map((interval) => interval.label)).toEqual(expectedDegrees[scale.id]);
    }
  });
});
