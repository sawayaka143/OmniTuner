import { NOTE_NAMES } from '../data/instrument.constants';
import { TuningString } from '../models/instrument.model';

export interface NoteInfo {
  noteName: string;
  octave: number;
  cents: number;
  semitone: number;
}

export function noteFromFrequency(
  frequency: number,
  previousSemitone?: number,
): NoteInfo | null {
  if (frequency <= 0) return null;
  const semitones = 12 * Math.log2(frequency / 440);
  const nearestSemitone = Math.round(semitones);
  const rounded = previousSemitone !== undefined && Math.abs(semitones - previousSemitone) < 0.6
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

export function needlePosition(noteInfo: NoteInfo | null): string {
  if (!noteInfo) return '50%';
  let cents = noteInfo.cents;
  cents = Math.max(-50, Math.min(50, cents));
  return `${50 + cents}%`;
}

export function isInTune(noteInfo: NoteInfo | null): boolean {
  return noteInfo !== null && Math.abs(noteInfo.cents) < 5;
}

export function findClosestString(
  frequency: number | null,
  strings: TuningString[],
): string | null {
  if (!frequency || frequency <= 0) return null;
  let closest: TuningString | null = null;
  let minRatio = Infinity;
  for (const s of strings) {
    const ratio = Math.abs(Math.log2(frequency / s.freq));
    if (ratio < minRatio) {
      minRatio = ratio;
      closest = s;
    }
  }
  return closest && minRatio < 0.09 ? closest.name : null;
}
