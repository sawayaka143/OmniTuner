import { SOUNDS, SoundBank } from './metronome-sounds';

class FakeParam {
  value = 0;
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeNode {
  connect(): void {}
  disconnect(): void {}
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  start(): void {}
  stop(): void {}
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  start(): void {}
  stop(): void {}
}

class FakeFilter extends FakeNode {
  type = 'bandpass';
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeBuffer {
  private readonly data = new Float32Array(64);

  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeAudioContext {
  readonly sampleRate = 48000;

  createGain(): GainNode {
    return new FakeGain() as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    return new FakeOscillator() as unknown as OscillatorNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    return new FakeBufferSource() as unknown as AudioBufferSourceNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new FakeFilter() as unknown as BiquadFilterNode;
  }

  createBuffer(): AudioBuffer {
    return new FakeBuffer() as unknown as AudioBuffer;
  }
}

describe('SoundBank', () => {
  let ctx: AudioContext;
  let out: FakeGain;

  beforeEach(() => {
    ctx = new FakeAudioContext() as unknown as AudioContext;
    out = new FakeGain();
  });

  const playAs = (id: string, vel = 1): AudioScheduledSourceNode[] =>
    new SoundBank(ctx).play(id, out as unknown as AudioNode, 0, vel);

  it('lists every sound with a label', () => {
    const options = SoundBank.options();

    expect(options.length).toBe(Object.keys(SOUNDS).length);
    for (const option of options) {
      expect(option.id.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it('reports which sound ids exist', () => {
    expect(SoundBank.has('cowbell')).toBe(true);
    expect(SoundBank.has('nope')).toBe(false);
  });

  it('plays an oscillator-based sound', () => {
    expect(playAs('beep-hi').length).toBe(1);
    expect(playAs('wood').length).toBe(1);
    expect(playAs('click').length).toBe(1);
  });

  it('plays a noise-based sound', () => {
    expect(playAs('shaker').length).toBe(1);
  });

  it('plays the composed sounds and the cowbell', () => {
    expect(playAs('rim').length).toBe(2);
    expect(playAs('snare').length).toBe(2);
    expect(playAs('cowbell').length).toBe(2);
  });

  it('falls back to the mid beep for an unknown id', () => {
    expect(playAs('does-not-exist').length).toBe(1);
  });

  it('clamps velocity into the supported range', () => {
    expect(() => playAs('beep-mid', -5)).not.toThrow();
    expect(() => playAs('beep-mid', 99)).not.toThrow();
  });

  it('reuses the cached noise buffer for repeated noise sounds', () => {
    expect(() => {
      playAs('shaker');
      playAs('snare');
      playAs('rim');
    }).not.toThrow();
  });

  it('does not throw when playback nodes cannot be disconnected', () => {
    expect(() => SOUNDS['beep-lo'].play(ctx, out as unknown as AudioNode, 0, 1)).not.toThrow();
  });
});
