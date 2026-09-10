import {
  DEFAULT_INTERVAL_COLOR,
  INTERVAL_COLORS,
  colorForLabel,
  textColorOn,
} from './interval-colors';

describe('interval colors', () => {
  it('maps known interval labels to their color', () => {
    expect(colorForLabel('R')).toBe(INTERVAL_COLORS['R']);
    expect(colorForLabel('m3')).toBe('#ff9900');
    expect(colorForLabel('♭7')).toBe('#ee6600');
  });

  it('falls back to the default color for unknown labels', () => {
    expect(colorForLabel('nope')).toBe(DEFAULT_INTERVAL_COLOR);
  });

  it('picks a dark ink for light backgrounds', () => {
    expect(textColorOn('#ffffff')).toBe('#121211');
    expect(textColorOn('#ede8d0')).toBe('#121211');
  });

  it('picks a light ink for dark backgrounds', () => {
    expect(textColorOn('#000000')).toBe('#f5f5f3');
    expect(textColorOn('#121211')).toBe('#f5f5f3');
  });

  it('handles a missing hash and malformed input', () => {
    expect(textColorOn('ffffff')).toBe('#121211');
    expect(textColorOn('#abc')).toBe('#f5f5f3');
    expect(textColorOn('')).toBe('#f5f5f3');
  });
});
