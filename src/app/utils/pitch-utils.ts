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
export function shouldConfirm(options: {
  inRange: boolean;
  elapsedMs: number;
  holdMs: number;
}): boolean {
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

/** Nearest chromatic semitone (any octave) for a played MIDI float. */
export function nearestSemitone(playedMidiFloat: number | null): { midi: number } | null {
  if (playedMidiFloat === null || !Number.isFinite(playedMidiFloat)) return null;
  return { midi: Math.round(playedMidiFloat) };
}

/** Direction-only prompt readout, e.g. TUNE UP / TUNE DOWN / IN TUNE. */
export function tuneDirectionText(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '\u2014';
  if (Math.abs(cents) < 5) return 'IN TUNE';
  return cents < 0 ? 'TUNE UP' : 'TUNE DOWN';
}

/** Cents-magnitude readout shown under the direction prompt. */
export function tuneCentsText(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '';
  if (Math.abs(cents) < 5) return '';
  return `${Math.abs(Math.round(cents))}\u00a2`;
}

/**
 * Linear blend between two six-digit hex colors. Returns null when either
 * color is invalid; t is clamped to [0, 1].
 */
export function interpolateColor(from: string, to: string, t: number): string | null {
  const parse = (hex: string): [number, number, number] | null => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return null;
    const value = Number.parseInt(match[1], 16);
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  };

  const fromRgb = parse(from);
  const toRgb = parse(to);
  if (!fromRgb || !toRgb) return null;

  const amount = Math.max(0, Math.min(1, t));
  const channels = fromRgb.map((channel, index) =>
    Math.round(channel + (toRgb[index] - channel) * amount),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Color-blend progress for the tune prompt: 0 when far off-pitch (≥ 50¢),
 * 1 at the ±5¢ in-tune boundary, linear between.
 */
export function tuneColorProgress(cents: number | null): number {
  if (cents === null || !Number.isFinite(cents)) return 0;
  const magnitude = Math.abs(cents);
  return Math.max(0, Math.min(1, (50 - magnitude) / 45));
}
