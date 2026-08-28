import { TestBed } from '@angular/core/testing';

import { DEFAULT_METRONOME_STATE, MetronomeState } from '../models/metronome.model';
import { METRONOME_AUDIO_CONTEXT_FACTORY, MetronomeAudio } from './metronome-audio.service';

class FakeGainParam {
  value = 0.9;
  cancelScheduledValues(): void {}
  setValueAtTime(): void {}
  setTargetAtTime(): void {}
}

class FakeGainNode {
  readonly gain = new FakeGainParam();
  connect(): FakeGainNode {
    return this;
  }
  disconnect(): void {}
}

class FakeCompressorNode {
  readonly threshold = { value: 0 };
  readonly knee = { value: 0 };
  readonly ratio = { value: 0 };
  readonly attack = { value: 0 };
  readonly release = { value: 0 };
  connect(): void {}
}

class FakeAudioContext {
  currentTime = 1000;
  state = 'running';
  sampleRate = 48000;
  readonly destination = {};
  readonly resume = vi.fn(async () => {});
  addEventListener(): void {}
  removeEventListener(): void {}
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode();
  }
}

const silent = (state: MetronomeState): MetronomeState => ({
  ...state,
  sounds: {
    downbeat: { ...state.sounds.downbeat, vol: 0 },
    beat: { ...state.sounds.beat, vol: 0 },
    subdivision: { ...state.sounds.subdivision, vol: 0 },
    poly: { ...state.sounds.poly, vol: 0, accentVol: 0 },
  },
});

const setup = (
  overrides: Partial<MetronomeState>,
): { service: MetronomeAudio; ctx: FakeAudioContext } => {
  const ctx = new FakeAudioContext();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      MetronomeAudio,
      {
        provide: METRONOME_AUDIO_CONTEXT_FACTORY,
        useValue: (): FakeAudioContext => ctx,
      },
    ],
  });
  const service = TestBed.inject(MetronomeAudio);
  service.configure(silent({ ...DEFAULT_METRONOME_STATE, ...overrides }));
  return { service, ctx };
};

describe('MetronomeAudio count-in and ramp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays a count-in bar before bar 0 when enabled', async () => {
    vi.useFakeTimers();
    const { service, ctx } = setup({ countIn: true, bpm: 60 });
    await service.start();

    let transport = service.getTransport();
    expect(transport?.countIn).toBe(true);
    expect(transport?.barIndex).toBe(-1);

    ctx.currentTime += 4.5;
    vi.advanceTimersByTime(60);

    transport = service.getTransport();
    expect(transport?.countIn).toBe(false);
    expect(transport?.barIndex).toBe(0);
    expect(transport?.barActive).toBe(true);

    service.stop();
  });

  it('starts at bar 0 immediately when count-in is off', async () => {
    vi.useFakeTimers();
    const { service } = setup({ countIn: false, bpm: 60 });
    await service.start();

    const transport = service.getTransport();
    expect(transport?.countIn).toBe(false);
    expect(transport?.barIndex).toBe(0);

    service.stop();
  });

  it('ramps the effective tempo up to the target over the given bars', async () => {
    vi.useFakeTimers();
    const { service, ctx } = setup({
      bpm: 100,
      ramp: { enabled: true, targetBpm: 200, bars: 2 },
    });
    await service.start();

    let transport = service.getTransport();
    expect(transport?.bpm).toBe(100);

    // bar 0 @100, bar 1 @150, bar 2 @200 → ~5.2s total; step well past it
    ctx.currentTime += 8.2;
    vi.advanceTimersByTime(60);

    transport = service.getTransport();
    expect(transport?.bpm).toBe(200);

    service.stop();
  });

  it('keeps the tempo flat when the ramp is disabled', async () => {
    vi.useFakeTimers();
    const { service, ctx } = setup({
      bpm: 100,
      ramp: { enabled: false, targetBpm: 200, bars: 2 },
    });
    await service.start();

    ctx.currentTime += 8.2;
    vi.advanceTimersByTime(60);

    expect(service.getTransport()?.bpm).toBe(100);

    service.stop();
  });
});
