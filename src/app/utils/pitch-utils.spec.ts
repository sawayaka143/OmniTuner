import {
  centsFromMidiFloat,
  frequencyToMidiFloat,
  frequencyToMidiNote,
  interpolateColor,
  midiNoteLabel,
  midiNoteToFrequency,
  nearestSemitone,
  nearestStringTarget,
  needlePercentFromCents,
  shouldConfirm,
  tuneCentsText,
  tuneColorProgress,
  tuneDirectionText,
} from './pitch-utils';

const GUITAR_STANDARD = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.0 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196.0 },
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 },
];

describe('nearestStringTarget', () => {
  it('picks the nearest string and measures signed unclamped cents against it', () => {
    expect(nearestStringTarget(40, GUITAR_STANDARD)).toMatchObject({
      name: 'E2',
      midi: 40,
      cents: 0,
    });

    const sixtyCentsSharpE2 = 40 + 0.6;
    const sharp = nearestStringTarget(sixtyCentsSharpE2, GUITAR_STANDARD);

    expect(sharp).toMatchObject({ name: 'E2', midi: 40 });
    expect(sharp?.cents).toBeCloseTo(60, 6);
  });

  it('is octave-aware: E4 is targeted for a high E, not E2', () => {
    const target = nearestStringTarget(64, GUITAR_STANDARD);

    expect(target).toMatchObject({ name: 'E4', midi: 64, cents: 0 });
  });

  it('keeps the previous target within the hysteresis margin and switches beyond it', () => {
    expect(nearestStringTarget(42.55, GUITAR_STANDARD)).toMatchObject({ name: 'A2' });

    expect(nearestStringTarget(42.55, GUITAR_STANDARD, 'E2')).toMatchObject({ name: 'E2' });

    expect(nearestStringTarget(42.6, GUITAR_STANDARD, 'E2')).toMatchObject({ name: 'A2' });
  });

  it('ignores a previous name that is not part of the tuning', () => {
    const target = nearestStringTarget(45, GUITAR_STANDARD, 'C3');

    expect(target).toMatchObject({ name: 'A2' });
  });

  it('returns null for invalid input or an empty tuning', () => {
    expect(nearestStringTarget(null, GUITAR_STANDARD)).toBeNull();
    expect(nearestStringTarget(Number.NaN, GUITAR_STANDARD)).toBeNull();
    expect(nearestStringTarget(40, [])).toBeNull();
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

describe('A4 calibration (ref parameter)', () => {
  it('midiNoteToFrequency shifts with the reference pitch', () => {
    expect(midiNoteToFrequency(69, 442)).toBe(442);
    expect(midiNoteToFrequency(69, 415)).toBe(415);
    expect(midiNoteToFrequency(69, 466)).toBe(466);

    expect(midiNoteToFrequency(69)).toBe(440);
  });

  it('frequencyToMidiNote respects the reference pitch', () => {
    expect(frequencyToMidiNote(442, 442)).toBe(69);

    expect(frequencyToMidiNote(440, 442)).toBe(69);
  });

  it('frequencyToMidiFloat respects the reference pitch', () => {
    expect(frequencyToMidiFloat(442, 442)).toBe(69);
    expect(frequencyToMidiFloat(440, 442)).toBeCloseTo(68.92, 1);
  });
});

describe('cents offset readout', () => {
  it('measures unclamped cents against a target MIDI note', () => {
    expect(centsFromMidiFloat(69, 69)).toBe(0);
    expect(centsFromMidiFloat(69.1, 69)).toBeCloseTo(10, 2);
    expect(centsFromMidiFloat(67, 64)).toBeCloseTo(300, 2);
    expect(centsFromMidiFloat(null, 64)).toBeNull();
  });

  it('renders the direction prompt without cents', () => {
    expect(tuneDirectionText(0)).toBe('IN TUNE');
    expect(tuneDirectionText(-3.2)).toBe('IN TUNE');
    expect(tuneDirectionText(12.4)).toBe('TUNE DOWN');
    expect(tuneDirectionText(-187.7)).toBe('TUNE UP');
    expect(tuneDirectionText(null)).toBe('\u2014');
    expect(tuneDirectionText(Number.NaN)).toBe('\u2014');
  });

  it('treats the threshold boundary as in tune (<=)', () => {
    expect(tuneDirectionText(5)).toBe('IN TUNE');
    expect(tuneDirectionText(8, 8)).toBe('IN TUNE');
    expect(tuneDirectionText(-8, 8)).toBe('IN TUNE');
  });

  it('honors a custom in-tune threshold for the direction prompt', () => {
    expect(tuneDirectionText(6, 8)).toBe('IN TUNE');
    expect(tuneDirectionText(-6, 8)).toBe('IN TUNE');
    expect(tuneDirectionText(9, 8)).toBe('TUNE DOWN');
    expect(tuneDirectionText(-9, 8)).toBe('TUNE UP');

    expect(tuneDirectionText(6)).toBe('TUNE DOWN');
  });

  it('renders the cents magnitude under the prompt', () => {
    expect(tuneCentsText(0)).toBe('');
    expect(tuneCentsText(-3.2)).toBe('');
    expect(tuneCentsText(12.4)).toBe('12¢');
    expect(tuneCentsText(-187.7)).toBe('188¢');
    expect(tuneCentsText(null)).toBe('');
    expect(tuneCentsText(Number.NaN)).toBe('');
  });

  it('treats the threshold boundary as in tune for the cents readout (<=)', () => {
    expect(tuneCentsText(5)).toBe('');
    expect(tuneCentsText(8, 8)).toBe('');
    expect(tuneCentsText(-8, 8)).toBe('');
  });

  it('honors a custom in-tune threshold for the cents readout', () => {
    expect(tuneCentsText(6, 8)).toBe('');
    expect(tuneCentsText(-6, 8)).toBe('');
    expect(tuneCentsText(9, 8)).toBe('9¢');
    expect(tuneCentsText(-9, 8)).toBe('9¢');

    expect(tuneCentsText(6)).toBe('6¢');
  });
});

describe('nearestSemitone', () => {
  it('rounds the played MIDI float to the nearest chromatic semitone', () => {
    expect(nearestSemitone(69)).toEqual({ midi: 69 });
    expect(nearestSemitone(69.1)).toEqual({ midi: 69 });
    expect(nearestSemitone(69.6)).toEqual({ midi: 70 });
    expect(nearestSemitone(null)).toBeNull();
    expect(nearestSemitone(Number.NaN)).toBeNull();
  });
});

describe('interpolateColor', () => {
  it('blends two hex colors linearly per channel', () => {
    expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(interpolateColor('#000000', '#ffffff', 0.25)).toBe('#404040');
    expect(interpolateColor('#ff0000', '#00ff00', 0.5)).toBe('#808000');
  });

  it('clamps t to [0, 1]', () => {
    expect(interpolateColor('#000000', '#ffffff', -1)).toBe('#000000');
    expect(interpolateColor('#000000', '#ffffff', 2)).toBe('#ffffff');
  });

  it('returns null for invalid colors', () => {
    expect(interpolateColor('red', '#ffffff', 0.5)).toBeNull();
    expect(interpolateColor('#000000', 'blue', 0.5)).toBeNull();
    expect(interpolateColor('#123', '#ffffff', 0.5)).toBeNull();
  });
});

describe('tuneColorProgress', () => {
  it('maps cents distance onto the 50→5 cent blend window', () => {
    expect(tuneColorProgress(50)).toBe(0);
    expect(tuneColorProgress(-50)).toBe(0);
    expect(tuneColorProgress(5)).toBe(1);
    expect(tuneColorProgress(-5)).toBe(1);
    expect(tuneColorProgress(27.5)).toBeCloseTo(0.5, 5);
    expect(tuneColorProgress(3)).toBe(1);
    expect(tuneColorProgress(null)).toBe(0);
    expect(tuneColorProgress(Number.NaN)).toBe(0);
  });

  it('ends the ramp at the custom threshold when it exceeds 5¢', () => {
    expect(tuneColorProgress(8, 8)).toBe(1);
    expect(tuneColorProgress(-8, 8)).toBe(1);
    expect(tuneColorProgress(29, 8)).toBeCloseTo(0.5, 5);
    expect(tuneColorProgress(50, 8)).toBe(0);

    expect(tuneColorProgress(3, 1)).toBe(1);
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
