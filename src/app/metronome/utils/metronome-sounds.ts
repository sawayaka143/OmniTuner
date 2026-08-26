const NOISE = new WeakMap<AudioContext, AudioBuffer>();

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = NOISE.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    NOISE.set(ctx, buf);
  }
  return buf;
}

function envGain(ctx: AudioContext, out: AudioNode, t: number, peak: number, dur: number, attack = 0.002): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  gain.connect(out);
  return gain;
}

type SoundFn = (ctx: AudioContext, out: AudioNode, t: number, vel: number) => AudioScheduledSourceNode[];

function tone(options: {
  freq: number;
  endFreq?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
}): SoundFn {
  const { freq, endFreq, dur = 0.05, type = 'sine', gain = 1, attack = 0.002 } = options;
  return (ctx, out, t, vel) => {
    const g = envGain(ctx, out, t, vel * gain, dur, attack);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.85);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.08);
    osc.onended = (): void => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {}
    };
    return [osc];
  };
}

function noiseHit(options: {
  dur?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  gain?: number;
  attack?: number;
}): SoundFn {
  const { dur = 0.08, type = 'bandpass', freq = 2000, q = 1, gain = 1, attack = 0.002 } = options;
  return (ctx, out, t, vel) => {
    const g = envGain(ctx, out, t, vel * gain, dur, attack);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter);
    filter.connect(g);
    src.start(t);
    src.stop(t + dur + 0.08);
    src.onended = (): void => {
      try {
        src.disconnect();
        filter.disconnect();
        g.disconnect();
      } catch {}
    };
    return [src];
  };
}

function cowbellSound(): SoundFn {
  return (ctx, out, t, vel) => {
    const g = envGain(ctx, out, t, vel * 0.8, 0.16, 0.001);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 760;
    bandpass.Q.value = 1.4;
    bandpass.connect(g);
    const oscs = [556, 833].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(bandpass);
      osc.start(t);
      osc.stop(t + 0.22);
      return osc;
    });
    oscs[0].onended = (): void => {
      try {
        for (const osc of oscs) osc.disconnect();
        bandpass.disconnect();
        g.disconnect();
      } catch {}
    };
    return oscs;
  };
}

const compose =
  (...fns: SoundFn[]): SoundFn =>
  (ctx, out, t, vel) =>
    fns.reduce<AudioScheduledSourceNode[]>((nodes, fn) => nodes.concat(fn(ctx, out, t, vel)), []);

export const SOUNDS: Record<string, { label: string; play: SoundFn }> = {
  'beep-hi': { label: 'Beep · high', play: tone({ freq: 1760, dur: 0.05 }) },
  'beep-mid': { label: 'Beep · mid', play: tone({ freq: 1244.5, dur: 0.05 }) },
  'beep-lo': { label: 'Beep · low', play: tone({ freq: 932.3, dur: 0.045 }) },
  wood: { label: 'Woodblock', play: tone({ freq: 1150, endFreq: 540, dur: 0.04 }) },
  clave: { label: 'Clave', play: tone({ freq: 2480, endFreq: 2000, dur: 0.035 }) },
  rim: {
    label: 'Rimshot',
    play: compose(
      noiseHit({ dur: 0.025, type: 'highpass', freq: 2800, gain: 0.7 }),
      tone({ freq: 480, dur: 0.03, gain: 0.8 }),
    ),
  },
  snare: {
    label: 'Snare',
    play: compose(
      noiseHit({ dur: 0.09, freq: 1800, q: 0.7 }),
      tone({ freq: 196, type: 'triangle', dur: 0.05, gain: 0.6 }),
    ),
  },
  shaker: { label: 'Shaker', play: noiseHit({ dur: 0.06, type: 'highpass', freq: 5200, attack: 0.006, gain: 0.85 }) },
  cowbell: { label: 'Cowbell', play: cowbellSound() },
  click: { label: 'Click', play: tone({ freq: 1200, type: 'square', dur: 0.04, gain: 0.9 }) },
};

export type SoundId = keyof typeof SOUNDS;

export class SoundBank {
  constructor(private readonly ctx: AudioContext) {}

  play(id: string, out: AudioNode, t: number, vel: number): AudioScheduledSourceNode[] {
    const entry = SOUNDS[id] ?? SOUNDS['beep-mid'];
    return entry.play(this.ctx, out, t, Math.max(0.0001, Math.min(1.2, vel)));
  }

  static options(): readonly { id: string; label: string }[] {
    return Object.entries(SOUNDS).map(([id, entry]) => ({ id, label: entry.label }));
  }

  static has(id: string): boolean {
    return id in SOUNDS;
  }
}
