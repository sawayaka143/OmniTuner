export const INTERVAL_COLORS: Readonly<Record<string, string>> = {
  R: '#779900',
  '1': '#779900',

  '3': '#ff9900',
  m3: '#ff9900',
  '♭3': '#ff9900',
  sus2: '#ff9900',
  sus4: '#ff9900',

  '5': '#227799',
  b5: '#227799',
  '♭5': '#227799',
  '#5': '#227799',

  b6: '#ee6600',
  '♭6': '#ee6600',
  '6': '#ee6600',
  dim7: '#ee6600',
  '7': '#ee6600',
  '♭7': '#ee6600',
  maj7: '#ee6600',

  '2': '#ee0000',
  '4': '#ee0000',
  '9': '#ee0000',
  '11': '#ee0000',
  '13': '#ee0000',

  b9: '#bb3366',
  '♭2': '#bb3366',
  '#9': '#bb3366',
  '#11': '#bb3366',
  '♯4': '#bb3366',
  b13: '#bb3366',
};

export const DEFAULT_INTERVAL_COLOR = '#94948e';

export const colorForLabel = (label: string): string =>
  INTERVAL_COLORS[label] ?? DEFAULT_INTERVAL_COLOR;

export const textColorOn = (hex: string): string => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#f5f5f3';
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const toLinear = (channel: number): number =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.45 ? '#121211' : '#f5f5f3';
};
