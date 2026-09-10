import { FLAT_DISPLAY_NAMES, SHARP_DISPLAY_NAMES, midiDisplayName } from './note-display-names';

describe('note display names', () => {
  it('names the twelve pitch classes', () => {
    expect(SHARP_DISPLAY_NAMES.length).toBe(12);
    expect(FLAT_DISPLAY_NAMES.length).toBe(12);
  });

  it('formats a MIDI note with its octave, defaulting to sharps', () => {
    expect(midiDisplayName(60)).toBe('C4');
    expect(midiDisplayName(69)).toBe('A4');
    expect(midiDisplayName(40)).toBe('E2');
  });

  it('formats flats when asked', () => {
    expect(midiDisplayName(61, 'flat')).toBe('D♭4');
    expect(midiDisplayName(61, 'sharp')).toBe('C♯4');
  });

  it('wraps correctly below the MIDI zero point', () => {
    expect(midiDisplayName(0)).toBe('C-1');
    expect(midiDisplayName(-1)).toBe('B-2');
  });
});
