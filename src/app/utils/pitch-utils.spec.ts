import { noteFromFrequency } from './pitch-utils';

describe('noteFromFrequency', () => {
  it('keeps the previous note until the pitch crosses the 60-cent hysteresis boundary', () => {
    const fiftyFiveCentsSharp = 440 * 2 ** (0.55 / 12);
    const heldNote = noteFromFrequency(fiftyFiveCentsSharp, 0);

    expect(heldNote).toMatchObject({ noteName: 'A', octave: 4, cents: 55, semitone: 0 });

    const sixtyOneCentsSharp = 440 * 2 ** (0.61 / 12);
    const advancedNote = noteFromFrequency(sixtyOneCentsSharp, 0);

    expect(advancedNote).toMatchObject({ noteName: 'A#', octave: 4, cents: -39, semitone: 1 });
  });
});
