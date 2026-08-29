import { TestBed } from '@angular/core/testing';
import { SCALE_AUDIO_CONTEXT_FACTORY, ScalePlayback, midiToFrequency } from './scale-playback';
import { nearestGuitarSample } from '../data/guitar-samples';

const audioParam = () => ({
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

interface StubAudioContextExtras {
  readonly bufferSource: {
    buffer: AudioBuffer | null;
    playbackRate: { value: number };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  readonly oscillator: {
    type: string;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  readonly decodeAudioData: ReturnType<typeof vi.fn>;
}

type StubAudioContext = AudioContext & StubAudioContextExtras;

const makeStubContext = (): StubAudioContext => {
  const decodeAudioData = vi.fn().mockResolvedValue({ duration: 1.2 });
  const bufferSource = {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const oscillator = {
    type: '',
    frequency: audioParam(),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    close: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => ({ gain: audioParam(), connect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({ type: '', frequency: audioParam(), connect: vi.fn() })),
    createBufferSource: vi.fn(() => bufferSource),
    decodeAudioData,
    bufferSource,
    oscillator,
  } as unknown as StubAudioContext;
};

describe('ScalePlayback', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

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

    factory.mockReturnValue(makeStubContext());
    service.playNote(70);
    expect(service.error()).toBeNull();
  });

  it('plays a decoded sample at the right playback rate for the nearest root', async () => {
    const context = makeStubContext();
    const factory = vi.fn(() => context);
    const fetchStub = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    vi.stubGlobal('fetch', fetchStub);
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });

    const service = TestBed.inject(ScalePlayback);
    service.playSampleNote(70);

    await vi.waitFor(() => {
      expect(context.decodeAudioData).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(context.bufferSource.start).toHaveBeenCalled();
    });

    expect(fetchStub).toHaveBeenCalledWith('audio/guitar/a4_mf_rr1.wav');
    expect(context.bufferSource.playbackRate.value).toBeCloseTo(2 ** (1 / 12), 5);
  });

  it('falls back to the oscillator playNote outside the recorded range', () => {
    const context = makeStubContext();
    const factory = vi.fn(() => context);
    TestBed.configureTestingModule({
      providers: [{ provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: factory }],
    });

    const service = TestBed.inject(ScalePlayback);
    service.playSampleNote(20);

    expect(context.oscillator.start).toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it('maps MIDI notes to SFZ pitch_keycenter roots', () => {
    expect(nearestGuitarSample(69)?.rootMidi).toBe(69);
    expect(nearestGuitarSample(70)?.rootMidi).toBe(69);
    expect(nearestGuitarSample(61)?.rootMidi).toBe(60);
  });
});
