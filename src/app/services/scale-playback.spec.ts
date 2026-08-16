import { TestBed } from '@angular/core/testing';
import { SCALE_AUDIO_CONTEXT_FACTORY, ScalePlayback, midiToFrequency } from './scale-playback';

describe('ScalePlayback', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('converts MIDI notes to equal-tempered frequencies', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBe(220);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 2);
  });

  it('does not create an audio context until playback is requested', () => {
    const factory = vi.fn(() => null);
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });

    const service = TestBed.inject(ScalePlayback);
    expect(factory).not.toHaveBeenCalled();

    service.playNote(69);
    expect(factory).toHaveBeenCalledOnce();
  });
});
