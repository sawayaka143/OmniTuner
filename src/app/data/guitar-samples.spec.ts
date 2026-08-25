import {
  guitarSamplePlaybackRate,
  GUITAR_SAMPLES,
  GUITAR_SAMPLE_MAX_MIDI,
  GUITAR_SAMPLE_MIN_MIDI,
  nearestGuitarSample,
} from './guitar-samples';

describe('guitar-samples', () => {
  it('maps every sample to its SFZ pitch_keycenter root', () => {
    expect(GUITAR_SAMPLES.map((s) => s.rootMidi)).toEqual([
      37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 86,
    ]);
  });

  it('uses unique mf_rr1 file names', () => {
    const files = GUITAR_SAMPLES.map((s) => s.file);
    expect(new Set(files).size).toBe(files.length);
    files.forEach((file) => expect(file).toMatch(/^[a-z0-9]+_mf_rr1\.wav$/));
  });

  it('returns the nearest root for a MIDI note', () => {
    expect(nearestGuitarSample(37)?.rootMidi).toBe(37);
    expect(nearestGuitarSample(38)?.rootMidi).toBe(37); // 1 semitone from Db2, 2 from E2
    expect(nearestGuitarSample(40)?.rootMidi).toBe(40);
    expect(nearestGuitarSample(61)?.rootMidi).toBe(60);
    expect(nearestGuitarSample(62)?.rootMidi).toBe(63);
    expect(nearestGuitarSample(86)?.rootMidi).toBe(86);
  });

  it('returns null outside the recorded range', () => {
    expect(nearestGuitarSample(GUITAR_SAMPLE_MIN_MIDI - 1)).toBeNull();
    expect(nearestGuitarSample(GUITAR_SAMPLE_MAX_MIDI + 1)).toBeNull();
  });

  it('computes the equal-tempered playback rate', () => {
    expect(guitarSamplePlaybackRate(69, 69)).toBe(1);
    expect(guitarSamplePlaybackRate(70, 69)).toBeCloseTo(2 ** (1 / 12), 5);
    expect(guitarSamplePlaybackRate(68, 69)).toBeCloseTo(2 ** (-1 / 12), 5);
    expect(guitarSamplePlaybackRate(84, 86)).toBeCloseTo(2 ** (-2 / 12), 5);
  });
});
