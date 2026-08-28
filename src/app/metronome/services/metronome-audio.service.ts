import { DestroyRef, InjectionToken, Service, inject, signal } from '@angular/core';
import { DEFAULT_METRONOME_STATE, MetronomeState } from '../models/metronome.model';
import { BarEvent, buildBarEvents, meterModel } from '../utils/metronome-timing';
import { SoundBank } from '../utils/metronome-sounds';

export type AudioContextFactory = () => AudioContext | null;

export const METRONOME_AUDIO_CONTEXT_FACTORY = new InjectionToken<AudioContextFactory>(
  'Metronome audio context factory',
  {
    factory: () => () => {
      try {
        return new AudioContext();
      } catch {
        return null;
      }
    },
  },
);

const TICK_MS = 25;
const LOOKAHEAD_VISIBLE_S = 0.12;
const LOOKAHEAD_HIDDEN_S = 1.1;
const START_DELAY_S = 0.08;

const STAGED_KEYS = new Set(['numerator', 'denominator', 'subdivision', 'poly', 'pattern']);

@Service()
export class MetronomeAudio {
  private readonly createContext = inject(METRONOME_AUDIO_CONTEXT_FACTORY);
  private readonly destroyRef = inject(DestroyRef);

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bank: SoundBank | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  readonly isPlaying = signal(false);
  readonly currentBar = signal(0);
  readonly currentTickInBar = signal(0);
  readonly currentTime = signal(0);
  readonly error = signal<string | null>(null);
  readonly transport = signal<{
    progress: number;
    barIndex: number;
    patternPos: number;
    beatsPerBar: number;
    barActive: boolean;
    countIn: boolean;
    bpm: number;
  } | null>(null);

  private config: MetronomeState = JSON.parse(
    JSON.stringify(DEFAULT_METRONOME_STATE),
  ) as MetronomeState;

  private dirty = false;
  private activeSources: AudioScheduledSourceNode[] = [];

  private barCount = 0;
  private patternPos = 0;
  private barBase = 0;
  private anchorT = 0;
  private anchorB = 0;
  private spb = 60 / this.config.bpm;
  private rampStartBpm = this.config.bpm;
  private inCountIn = false;
  private barEvents: ReturnType<typeof buildBarEvents> = [];
  private nextIdx = 0;
  private model = meterModel(
    this.config.timeSignature.numerator,
    this.config.timeSignature.denominator,
  );

  private timer: ReturnType<typeof setInterval> | null = null;
  private muteTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;

  private onVisibility: (() => void) | null = null;
  private onStateChange: (() => void) | null = null;
  private onUnlockTouch: (() => void) | null = null;
  private onUnlockClick: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.teardown());
    document.addEventListener('visibilitychange', () => {
      if (this.isPlaying()) this.tick();
    });
  }

  getTransport(): {
    progress: number;
    barIndex: number;
    patternPos: number;
    beatsPerBar: number;
    barActive: boolean;
    countIn: boolean;
    bpm: number;
  } | null {
    if (!this.isPlaying() || !this.context) return null;
    const barStart = this.anchorT + (this.barBase - this.anchorB) * this.spb;
    const dur = this.model.beatsPerBar * this.spb;
    const progress = (this.context.currentTime - barStart) / dur;
    return {
      progress: Math.max(0, Math.min(progress, 1)),
      barIndex: this.barCount,
      patternPos: this.patternPos,
      beatsPerBar: this.model.beatsPerBar,
      barActive: this.barCount < 0 || this.config.barPattern[this.patternPos] === 1,
      countIn: this.barCount < 0,
      bpm: Math.round(60 / this.spb),
    };
  }

  configure(state: MetronomeState): void {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(state as unknown as Record<string, unknown>)) {
      const prev = (this.config as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(prev) !== JSON.stringify(value)) patch[key] = value;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'bpm') {
        const bpm = value as number;
        if (bpm === this.config.bpm) continue;
        this.config = { ...this.config, bpm };
        if (this.isPlaying()) this.retune();
        else this.spb = 60 / bpm;
      } else if (key === 'masterVol') {
        this.config = { ...this.config, masterVol: value as number };
        if (this.masterGain && this.context) {
          this.masterGain.gain.setTargetAtTime(value as number, this.context.currentTime, 0.02);
        }
      } else if (key === 'sounds') {
        this.config = { ...this.config, sounds: value as MetronomeState['sounds'] };
      } else if (
        STAGED_KEYS.has(key) ||
        key === 'timeSignature' ||
        key === 'divisionsPerBeat' ||
        key === 'barPattern' ||
        key === 'poly'
      ) {
        (this.config as unknown as Record<string, unknown>)[key] = value;
        this.dirty = true;
      } else {
        (this.config as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  set(patch: Partial<MetronomeState> & Record<string, unknown>): void {
    this.configure({ ...this.config, ...patch });
  }

  async start(): Promise<void> {
    if (this.isPlaying()) return;
    await this.ensureAudio();
    if (!this.context || !this.masterGain) {
      this.error.set('Audio playback is unavailable in this browser.');
      return;
    }
    this.error.set(null);
    if (this.muteTimer) {
      clearTimeout(this.muteTimer);
      this.muteTimer = null;
    }
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.config.masterVol, now);

    this.dirty = false;
    this.model = meterModel(
      this.config.timeSignature.numerator,
      this.config.timeSignature.denominator,
    );
    this.spb = 60 / this.config.bpm;
    this.rampStartBpm = this.config.bpm;
    this.inCountIn = this.config.countIn;
    this.barCount = this.inCountIn ? -1 : 0;
    this.patternPos = 0;
    this.barBase = this.inCountIn ? -this.model.beatsPerBar : 0;
    this.anchorB = this.barBase;
    this.anchorT = now + START_DELAY_S;
    this.buildBar();
    this.nextIdx = 0;

    this.isPlaying.set(true);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.startRaf();
  }

  stop(): void {
    if (!this.isPlaying()) return;
    this.isPlaying.set(false);
    this.inCountIn = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopRaf();

    if (this.context && this.masterGain) {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.008);
      const sources = this.activeSources;
      this.activeSources = [];
      this.muteTimer = setTimeout(() => {
        for (const node of sources) {
          try {
            node.stop();
          } catch {}
        }
        if (this.context && this.masterGain) {
          this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
          this.masterGain.gain.setValueAtTime(this.config.masterVol, this.context.currentTime);
        }
        this.muteTimer = null;
      }, 80);
    }
    this.removeResumeListeners();
    this.removeUnlockListeners();
  }

  async toggle(): Promise<void> {
    if (this.isPlaying()) this.stop();
    else await this.start();
  }

  previewMain(): void {
    void this.ensureAudio().then(() => {
      if (!this.context || !this.masterGain || !this.bank) return;
      const t = this.context.currentTime + 0.02;
      for (const node of this.bank.play(
        this.config.sounds.beat.id,
        this.masterGain,
        t,
        this.config.sounds.beat.vol,
      )) {
        this.trackSource(node);
      }
    });
  }

  previewPoly(): void {
    void this.ensureAudio().then(() => {
      if (!this.context || !this.masterGain || !this.bank) return;
      const t = this.context.currentTime + 0.02;
      for (const node of this.bank.play(
        this.config.sounds.poly.id,
        this.masterGain,
        t,
        this.config.sounds.poly.vol,
      )) {
        this.trackSource(node);
      }
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  private retune(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const elapsedB = this.anchorB + (now - this.anchorT) / this.spb;
    this.spb = 60 / this.config.bpm;
    this.anchorT = now;
    this.anchorB = elapsedB;
    this.rampStartBpm = this.config.bpm;
  }

  /** Shifts the tempo to `bpm` exactly at the bar boundary `atBeat`, keeping the beat grid continuous. */
  private setSpbAt(bpm: number, atBeat: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const t = this.anchorT + (atBeat - this.anchorB) * this.spb;
    this.anchorT = t;
    this.anchorB = atBeat;
    this.spb = 60 / bpm;
  }

  private applyRampStep(): void {
    if (!this.config.ramp.enabled || this.inCountIn || this.barCount < 0) return;
    const { bars, targetBpm } = this.config.ramp;
    const progress = Math.min(Math.max(this.barCount / Math.max(1, bars), 0), 1);
    const effBpm = this.rampStartBpm + (targetBpm - this.rampStartBpm) * progress;
    this.setSpbAt(effBpm, this.barBase);
  }

  private tick(): void {
    if (!this.isPlaying() || !this.context) return;
    const horizon =
      this.context.currentTime + (document.hidden ? LOOKAHEAD_HIDDEN_S : LOOKAHEAD_VISIBLE_S);
    const timeOf = (beat: number): number => this.anchorT + (beat - this.anchorB) * this.spb;
    let guard = 0;
    while (guard++ < 512) {
      if (this.nextIdx >= this.barEvents.length) {
        const endBeat = this.barBase + this.model.beatsPerBar;
        if (timeOf(endBeat) > horizon) break;
        this.advanceBar();
        continue;
      }
      const event = this.barEvents[this.nextIdx];
      const t = timeOf(this.barBase + event.beats);
      if (t > horizon) break;
      this.nextIdx++;
      if (t >= this.context.currentTime - 0.01)
        this.playEvent(event, Math.max(t, this.context.currentTime + 0.001));
    }
    if (this.activeSources.length > 600)
      this.activeSources = this.activeSources.filter(
        (n) => !(n as unknown as { _done?: boolean })._done,
      );
    const transport = this.getTransport();
    if (transport) this.transport.set(transport);
  }

  private advanceBar(): void {
    const finishedBeats = this.model.beatsPerBar;
    if (this.dirty) {
      this.dirty = false;
      this.model = meterModel(
        this.config.timeSignature.numerator,
        this.config.timeSignature.denominator,
      );
    }
    this.barBase += finishedBeats;
    this.barCount++;
    if (this.inCountIn) {
      this.inCountIn = false;
      this.patternPos = 0;
    } else {
      this.patternPos = (this.patternPos + 1) % Math.max(1, this.config.barPattern.length);
    }
    this.applyRampStep();
    this.buildBar();
    this.nextIdx = 0;
  }

  private buildBar(): void {
    const countInBar = this.inCountIn;
    const active = countInBar || this.config.barPattern[this.patternPos] === 1;
    this.barEvents = active
      ? countInBar
        ? this.buildCountInEvents()
        : buildBarEvents(this.model, {
            subdivision: this.config.divisionsPerBeat,
            poly: this.config.poly,
          })
      : [];
  }

  private buildCountInEvents(): BarEvent[] {
    const events: BarEvent[] = [];
    for (let b = 0; b < this.model.beatsPerBar; b++) {
      events.push({ beats: b, layer: 'meter', role: b === 0 ? 'downbeat' : 'beat' });
    }
    return events;
  }

  private playEvent(event: ReturnType<typeof buildBarEvents>[number], t: number): void {
    const spec = this.soundFor(event);
    if (spec && spec.vol > 0.002 && this.masterGain && this.bank) {
      for (const node of this.bank.play(spec.id, this.masterGain, t, spec.vol))
        this.trackSource(node);
    }
  }

  private soundFor(
    event: ReturnType<typeof buildBarEvents>[number],
  ): { id: string; vol: number } | null {
    const sounds = this.config.sounds;
    if (event.layer === 'poly') {
      const poly = sounds.poly;
      return {
        id: poly.id,
        vol: event.role === 'polyAccent' ? Math.min(1, poly.accentVol) : poly.vol,
      };
    }
    const role = sounds[event.role as keyof typeof sounds] as
      { id: string; vol: number } | undefined;
    const fallback = sounds.beat;
    return role ? { id: role.id, vol: role.vol } : { id: fallback.id, vol: fallback.vol };
  }

  private trackSource(node: AudioScheduledSourceNode): void {
    const prev = node.onended;
    node.onended = (): void => {
      (node as unknown as { _done?: boolean })._done = true;
      if (prev) prev.call(node, new Event('ended'));
    };
    this.activeSources.push(node);
  }

  private async ensureAudio(): Promise<void> {
    if (!this.context) {
      this.context = this.createContext();
    }
    if (!this.context) return;
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {}
    }
    if (!this.masterGain) {
      this.bank = new SoundBank(this.context);
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.config.masterVol;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 8;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.15;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.context.destination);
      this.installResumeListeners(this.context);
      this.installUnlockListeners(this.context);
    }
  }

  private startRaf(): void {
    const frame = (): void => {
      if (!this.isPlaying() || !this.context) return;
      const now = this.context.currentTime;
      const transport = this.getTransport();
      if (transport) {
        this.currentBar.set(transport.barIndex);
        this.currentTime.set(now);
        this.transport.set(transport);
      }
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private installResumeListeners(ctx: AudioContext): void {
    this.removeResumeListeners();
    this.onStateChange = (): void => {
      if (ctx.state === 'suspended' && this.isPlaying()) void ctx.resume().catch(() => {});
    };
    try {
      ctx.addEventListener('statechange', this.onStateChange);
    } catch {}
    this.onVisibility = (): void => {
      if (document.visibilityState === 'visible' && this.isPlaying())
        void ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private removeResumeListeners(): void {
    if (this.onStateChange && this.context) {
      try {
        this.context.removeEventListener('statechange', this.onStateChange);
      } catch {}
    }
    this.onStateChange = null;
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    this.onVisibility = null;
  }

  private installUnlockListeners(ctx: AudioContext): void {
    if (ctx.state === 'running') return;
    const unlock = (): void => {
      void ctx.resume().catch(() => {});
    };
    this.onUnlockTouch = unlock;
    this.onUnlockClick = unlock;
    document.addEventListener('touchend', this.onUnlockTouch, { once: true });
    document.addEventListener('click', this.onUnlockClick, { once: true });
    try {
      ctx.addEventListener(
        'statechange',
        () => {
          if (ctx.state === 'running') this.removeUnlockListeners();
        },
        { once: true },
      );
    } catch {}
  }

  private removeUnlockListeners(): void {
    if (this.onUnlockTouch) {
      document.removeEventListener('touchend', this.onUnlockTouch);
      this.onUnlockTouch = null;
    }
    if (this.onUnlockClick) {
      document.removeEventListener('click', this.onUnlockClick);
      this.onUnlockClick = null;
    }
  }

  private teardown(): void {
    this.stop();
    this.removeResumeListeners();
    this.removeUnlockListeners();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.context && this.context.state !== 'closed') {
      try {
        void this.context.close();
      } catch {}
    }
    this.context = null;
    this.masterGain = null;
    this.bank = null;
    this.compressor = null;
  }
}
