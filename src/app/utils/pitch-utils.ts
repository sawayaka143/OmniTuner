import { NOTE_NAMES } from '../data/instrument.constants';

export interface StringTarget {
  name: string;
  midi: number;
  cents: number;
}

export const HYSTERESIS_CENTS = 10;

export function midiNoteToFrequency(midiNote: number, ref = 440): number {
  return ref * 2 ** ((midiNote - 69) / 12);
}

export function frequencyToMidiNote(frequency: number, ref = 440): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return Math.round(69 + 12 * Math.log2(frequency / ref));
}

/** Unrounded MIDI value of a frequency, e.g. 440 Hz → 69, 441 Hz → ~69.0392. */
export function frequencyToMidiFloat(frequency: number, ref = 440): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return 69 + 12 * Math.log2(frequency / ref);
}

/** Cents offset between a (possibly fractional) played MIDI value and a target MIDI note. Unclamped. */
export function centsFromMidiFloat(
  playedMidiFloat: number | null,
  targetMidi: number,
): number | null {
  if (playedMidiFloat === null) return null;
  return (playedMidiFloat - targetMidi) * 100;
}

/**
 * String of the tuning closest to the played pitch, with signed unclamped
 * cents against it. String pitches are nominal (A4=440) so the target does
 * not move when the user changes the reference pitch. Hysteresis: while the
 * previous target is still within HYSTERESIS_CENTS of the winner it is kept,
 * so a midpoint pitch cannot flicker between two strings.
 */
export function nearestStringTarget(
  playedMidiFloat: number | null,
  strings: ReadonlyArray<{ name: string; freq: number }>,
  previousName?: string,
): StringTarget | null {
  if (playedMidiFloat === null || !Number.isFinite(playedMidiFloat) || strings.length === 0) {
    return null;
  }

  let best: StringTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let previous: { midi: number; distance: number } | null = null;

  for (const string of strings) {
    const midi = frequencyToMidiNote(string.freq) ?? 69;
    const cents = centsFromMidiFloat(playedMidiFloat, midi)!;
    const distance = Math.abs(cents);
    if (string.name === previousName) previous = { midi, distance };
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { name: string.name, midi, cents };
    }
  }

  if (!best) return null;
  if (previous && previous.distance <= bestDistance + HYSTERESIS_CENTS) {
    const cents = centsFromMidiFloat(playedMidiFloat, previous.midi)!;
    return { name: previousName!, midi: previous.midi, cents };
  }
  return best;
}

/**
 * Cents → needle position as a CSS `left` percentage. The needle/ruler clamps
 * to ±50¢ while the numeric value stays unclamped elsewhere.
 */
export function needlePercentFromCents(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '50%';
  return `${50 + Math.max(-50, Math.min(50, cents))}%`;
}

/**
 * Hold-timer rule for the in-tune lock: a pitch confirms only after it has
 * stayed inside the tolerance window for at least `holdMs`. Pure so the
 * edge cases get a real unit test.
 */
export function shouldConfirm(options: { inRange: boolean; elapsedMs: number; holdMs: number }): boolean {
  return options.inRange && options.elapsedMs >= options.holdMs;
}

export function midiNoteLabel(midiNote: number): string {
  const semitoneFromA = midiNote - 69;
  const noteIndex = ((semitoneFromA % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function hzDisplay(frequency: number | null): string {
  return frequency !== null ? `${frequency.toFixed(2)} Hz` : '\u2014 Hz';
}

/** Tune prompt readout: numeric and unclamped, with the direction to tune. */
export function tuneDirection(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '\u2014';
  if (Math.abs(cents) < 5) return 'IN TUNE';
  const rounded = Math.round(cents);
  return rounded < 0
    ? `${Math.abs(rounded)}\u00a2 TUNE UP`
    : `${rounded}\u00a2 TUNE DOWN`;
}
