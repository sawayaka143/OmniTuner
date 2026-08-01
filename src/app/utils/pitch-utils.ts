import { NOTE_NAMES } from '../data/instrument.constants';

export interface NoteInfo {
  noteName: string;
  octave: number;
  cents: number;
  semitone: number;
}

export function midiNoteToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

export function frequencyToMidiNote(frequency: number): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

/** Unrounded MIDI value of a frequency, e.g. 440 Hz → 69, 441 Hz → ~69.0392. */
export function frequencyToMidiFloat(frequency: number): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return 69 + 12 * Math.log2(frequency / 440);
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

export function noteFromFrequency(frequency: number, previousSemitone?: number): NoteInfo | null {
  if (frequency <= 0) return null;
  const semitones = 12 * Math.log2(frequency / 440);
  const nearestSemitone = Math.round(semitones);
  const rounded =
    previousSemitone !== undefined && Math.abs(semitones - previousSemitone) < 0.6
      ? previousSemitone
      : nearestSemitone;
  const cents = Math.round((semitones - rounded) * 100);
  const idx = ((rounded % 12) + 12) % 12;
  const octave = 4 + Math.floor((rounded + 9) / 12);
  return { noteName: NOTE_NAMES[idx], octave, cents, semitone: rounded };
}

export function hzDisplay(frequency: number | null): string {
  return frequency !== null ? `${frequency.toFixed(2)} Hz` : '\u2014 Hz';
}

export function centsOffsetDisplay(noteInfo: NoteInfo | null): string {
  if (!noteInfo) return '\u2014';
  if (Math.abs(noteInfo.cents) < 5) return 'IN TUNE';
  return noteInfo.cents < 0
    ? `${Math.abs(noteInfo.cents)}\u00a2 FLAT`
    : `${noteInfo.cents}\u00a2 SHARP`;
}

/** Cents readout for manual mode: numeric and unclamped, mirroring the auto-mode idiom. */
export function manualCentsOffset(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return '\u2014';
  if (Math.abs(cents) < 5) return 'IN TUNE';
  const rounded = Math.round(cents);
  return rounded < 0
    ? `${Math.abs(rounded)}\u00a2 FLAT`
    : `${rounded}\u00a2 SHARP`;
}

export function needlePosition(noteInfo: NoteInfo | null): string {
  return needlePercentFromCents(noteInfo ? noteInfo.cents : null);
}

export function isInTune(noteInfo: NoteInfo | null): boolean {
  return noteInfo !== null && Math.abs(noteInfo.cents) < 5;
}
