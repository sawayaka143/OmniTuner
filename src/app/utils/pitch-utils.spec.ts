import {
  centsFromMidiFloat,
  frequencyToMidiFloat,
  frequencyToMidiNote,
  manualCentsOffset,
  midiNoteLabel,
  midiNoteToFrequency,
  needlePercentFromCents,
  noteFromFrequency,
  shouldConfirm,
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

  it('converts frequencies to unrounded MIDI values', () => {
    expect(frequencyToMidiFloat(440)).toBe(69);
    expect(frequencyToMidiFloat(441)).toBeCloseTo(69.0392, 3);
    expect(frequencyToMidiFloat(0)).toBeNull();
    expect(frequencyToMidiFloat(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('manual-mode cents helpers', () => {
  it('measures unclamped cents against a target MIDI note', () => {
    expect(centsFromMidiFloat(69, 69)).toBe(0);
    expect(centsFromMidiFloat(69.1, 69)).toBeCloseTo(10, 2);
    expect(centsFromMidiFloat(67, 64)).toBeCloseTo(300, 2);
    expect(centsFromMidiFloat(null, 64)).toBeNull();
  });

  it('renders manual cents without clamping', () => {
    expect(manualCentsOffset(0)).toBe('IN TUNE');
    expect(manualCentsOffset(-3.2)).toBe('IN TUNE');
    expect(manualCentsOffset(12.4)).toBe('12¢ SHARP');
    expect(manualCentsOffset(-187.7)).toBe('188¢ FLAT');
    expect(manualCentsOffset(null)).toBe('\u2014');
    expect(manualCentsOffset(Number.NaN)).toBe('\u2014');
  });
});

describe('needle helpers', () => {
  it('clamps the needle position to the ±50¢ ruler', () => {
    expect(needlePercentFromCents(0)).toBe('50%');
    expect(needlePercentFromCents(25)).toBe('75%');
    expect(needlePercentFromCents(-25)).toBe('25%');
    expect(needlePercentFromCents(200)).toBe('100%');
    expect(needlePercentFromCents(-200)).toBe('0%');
    expect(needlePercentFromCents(null)).toBe('50%');
  });
});

describe('shouldConfirm', () => {
  it('confirms only after the pitch has held in range for the full hold time', () => {
    expect(shouldConfirm({ inRange: true, elapsedMs: 499, holdMs: 500 })).toBe(false);
    expect(shouldConfirm({ inRange: true, elapsedMs: 500, holdMs: 500 })).toBe(true);
    expect(shouldConfirm({ inRange: true, elapsedMs: 0, holdMs: 0 })).toBe(true);
  });

  it('never confirms while out of range, however long the hold', () => {
    expect(shouldConfirm({ inRange: false, elapsedMs: 5000, holdMs: 0 })).toBe(false);
  });
});
