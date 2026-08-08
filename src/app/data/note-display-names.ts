/**
 * Display note names using Unicode accidentals (♯ / ♭), C-rooted and indexable
 * by absolute pitch class (C = 0 … B = 11).
 *
 * Shared by the tuning editor and tuning selector so the two views can't drift
 * apart. Note the fretboard engine (`scale.constants.ts`) deliberately uses the
 * ASCII spellings (`#` / `b`) — these Unicode arrays are for *display* only.
 */
export const SHARP_DISPLAY_NAMES = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
] as const;

export const FLAT_DISPLAY_NAMES = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
] as const;

/**
 * Full display name for a MIDI note (e.g. 69 → 'A4'), using the Unicode
 * accidental spelling chosen by `accidental`. The single source of truth for
 * note rendering; the tuning editor, instrument manager and tuning selector
 * all render through it so the views can't drift apart.
 */
export const midiDisplayName = (
  midi: number,
  accidental: 'sharp' | 'flat' = 'sharp',
): string => {
  const names = accidental === 'flat' ? FLAT_DISPLAY_NAMES : SHARP_DISPLAY_NAMES;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
};
