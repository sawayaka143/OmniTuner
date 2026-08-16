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

  it('surfaces an error when the audio context cannot be created', () => {
    const factory = vi.fn(() => null);
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });

    const service = TestBed.inject(ScalePlayback);
    expect(service.error()).toBeNull();

    service.playNote(69);
    expect(service.error()).toContain('unavailable');
  });

  it('clears the error once the audio context is available', () => {
    const factory = vi.fn<() => AudioContext | null>(() => null);
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });

    const service = TestBed.inject(ScalePlayback);
    service.playNote(69);
    expect(service.error()).not.toBeNull();

    // A later successful creation clears the error.
    const audioParam = () => ({
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const stubContext = {
      state: 'running',
      currentTime: 0,
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: () => ({
        type: '',
        frequency: audioParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({ gain: audioParam(), connect: vi.fn() }),
      createBiquadFilter: () => ({ type: '', frequency: audioParam(), connect: vi.fn() }),
    } as unknown as AudioContext;
    factory.mockReturnValue(stubContext);
    service.playNote(70);
    expect(service.error()).toBeNull();
  });
});
