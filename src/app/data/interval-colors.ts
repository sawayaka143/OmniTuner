/**
 * Central map of interval label → color.
 *
 * Color is resolved by **label**, never by raw semitone offset, because the same
 * semitone can mean different things (a 9th vs. a sus2). Every label the product
 * uses today is listed here; extra labels are kept too so the same map is ready
 * for future features (e.g. a chord builder) without further edits.
 *
 * The exact mapping requested by the product:
 *   Root                       -> #779900
 *   3 / m3 / sus2 / sus4       -> #ff9900
 *   5th / b5 / #5              -> #227799
 *   b6 / 6 / dim7 / 7th / maj7 -> #ee6600
 *   9th / 11th / 13th          -> #ee0000
 *   b9 / #9 / #11 / b13        -> #bb3366
 */
export const INTERVAL_COLORS: Readonly<Record<string, string>> = {
  // Root
  R: '#779900',

  // 3rd family
  '3': '#ff9900',
  m3: '#ff9900',
  sus2: '#ff9900',
  sus4: '#ff9900',

  // 5th family
  '5': '#227799',
  b5: '#227799',
  '#5': '#227799',

  // 6th / 7th family
  b6: '#ee6600',
  '6': '#ee6600',
  dim7: '#ee6600',
  '7': '#ee6600',
  maj7: '#ee6600',

  // Natural extensions
  '9': '#ee0000',
  '11': '#ee0000',
  '13': '#ee0000',

  // Altered extensions
  b9: '#bb3366',
  '#9': '#bb3366',
  '#11': '#bb3366',
  b13: '#bb3366',
};

/** Fallback for any interval label not present in the map. Matches --text-dim. */
export const DEFAULT_INTERVAL_COLOR = '#62625d';

/** Resolve a color for an interval label, with a safe fallback. */
export const colorForLabel = (label: string): string =>
  INTERVAL_COLORS[label] ?? DEFAULT_INTERVAL_COLOR;

/**
 * Pick a readable foreground color for text/labels placed on top of a solid
 * background color, using the WCAG relative-luminance approximation. Returns the
 * app's near-black canvas or near-white text so foreground/background pairs stay
 * AA-contrast safe.
 *
 * @param hex a 6-digit hex color, e.g. '#779900'
 */
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
