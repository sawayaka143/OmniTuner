import {
  frequencyToMidiNote,
  midiNoteLabel,
  midiNoteToFrequency,
  noteFromFrequency,
} from './pitch-utils';

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

describe('MIDI note helpers', () => {
  it('converts MIDI notes to octave-aware labels and frequencies', () => {
    expect(midiNoteLabel(40)).toBe('E2');
    expect(midiNoteLabel(69)).toBe('A4');
    expect(midiNoteToFrequency(69)).toBe(440);
    expect(midiNoteToFrequency(40)).toBeCloseTo(82.41, 2);
  });

  it('converts frequencies to the nearest MIDI note', () => {
    expect(frequencyToMidiNote(440)).toBe(69);
    expect(frequencyToMidiNote(261.63)).toBe(60);
    expect(frequencyToMidiNote(0)).toBeNull();
    expect(frequencyToMidiNote(Number.NaN)).toBeNull();
  });
});
