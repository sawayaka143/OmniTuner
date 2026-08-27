export const SHARP_DISPLAY_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

export const FLAT_DISPLAY_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;

export const midiDisplayName = (midi: number, accidental: 'sharp' | 'flat' = 'sharp'): string => {
  const names = accidental === 'flat' ? FLAT_DISPLAY_NAMES : SHARP_DISPLAY_NAMES;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
};
