import { Denominator } from '../models/metronome.model';

export interface MeterModel {
  readonly numerator: number;
  readonly denominator: Denominator;
  readonly compound: boolean;
  readonly divisionsPerBeat: number;
  readonly beatsPerBar: number;
  readonly beatQuarters: number;
  readonly barQuarters: number;
}

const NOTE_NAME: Record<number, string> = { 2: 'half', 4: 'quarter', 8: 'eighth', 16: 'sixteenth' };

function noteName(denominator: number): string {
  return NOTE_NAME[denominator] ?? `1/${denominator}`;
}

export function meterModel(numerator: number, denominator: Denominator): MeterModel {
  const unitQuarters = 4 / denominator;
  const compound = numerator % 3 === 0 && numerator >= 6 && denominator >= 8;
  const divisionsPerBeat = compound ? 3 : 1;
  const beatsPerBar = compound ? numerator / 3 : numerator;
  return {
    numerator,
    denominator,
    compound,
    divisionsPerBeat,
    beatsPerBar,
    beatQuarters: unitQuarters * divisionsPerBeat,
    barQuarters: unitQuarters * numerator,
  };
}

export function describeMeter(model: MeterModel): string {
  if (model.compound) {
    return `Compound ${model.numerator}/${model.denominator} — ${model.beatsPerBar} dotted-${noteName(model.denominator)} beats per bar`;
  }
  return `${model.numerator}/${model.denominator} — ${model.beatsPerBar} ${noteName(model.denominator)}-note beat${model.beatsPerBar > 1 ? 's' : ''} per bar`;
}

export interface BarEvent {
  readonly beats: number;
  readonly layer: 'meter' | 'poly';
  readonly role: string;
}

export function buildBarEvents(
  model: MeterModel,
  options: {
    subdivision?: number;
    poly?: { enabled: boolean; events: number; accentFirst?: boolean };
  } = {},
): BarEvent[] {
  const subdivision = options.subdivision ?? 1;
  const poly = options.poly ?? null;
  const events: BarEvent[] = [];
  for (let b = 0; b < model.beatsPerBar; b++) {
    for (let s = 0; s < subdivision; s++) {
      events.push({
        beats: b + s / subdivision,
        layer: 'meter',
        role: b === 0 && s === 0 ? 'downbeat' : s === 0 ? 'beat' : 'subdivision',
      });
    }
  }
  if (poly && poly.enabled && poly.events > 0) {
    const span = model.beatsPerBar;
    for (let i = 0; i < poly.events; i++) {
      events.push({
        beats: (i * span) / poly.events,
        layer: 'poly',
        role: i === 0 && poly.accentFirst ? 'polyAccent' : 'poly',
      });
    }
  }
  events.sort((a, b) => a.beats - b.beats || (a.layer === 'meter' ? -1 : 1));
  return events;
}

export function quarterDuration(bpm: number): number {
  return 60 / bpm;
}

export function beatDuration(bpm: number, model: MeterModel): number {
  return (60 / bpm) * model.beatQuarters;
}

export function barDuration(bpm: number, model: MeterModel): number {
  return (60 / bpm) * model.barQuarters;
}

export function subdivisionInterval(
  bpm: number,
  model: MeterModel,
  divisionsPerBeat: number,
): number {
  return beatDuration(bpm, model) / divisionsPerBeat;
}

export function ticksPerBar(model: MeterModel, divisionsPerBeat: number): number {
  return model.beatsPerBar * divisionsPerBeat;
}

export type TickKind = 'downbeat' | 'beat' | 'subdivision';

export function tickKind(tickIndexInBar: number, divisionsPerBeat: number): TickKind {
  if (tickIndexInBar === 0) return 'downbeat';
  if (tickIndexInBar % divisionsPerBeat === 0) return 'beat';
  return 'subdivision';
}

export function polyTimes(barStart: number, barDur: number, count: number): readonly number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  const step = barDur / count;
  for (let i = 0; i < count; i++) out.push(barStart + i * step);
  return out;
}

export function isBarAudible(barIndex: number, pattern: readonly number[]): boolean {
  if (pattern.length === 0) return true;
  return (pattern[barIndex % pattern.length] ?? 1) === 1;
}

export function tapBpm(intervalsMs: readonly number[]): number | null {
  if (intervalsMs.length === 0) return null;
  const valid = intervalsMs.filter((v) => v > 120 && v < 2500);
  if (valid.length === 0) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round(60000 / avg);
}

export function formatBarDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function getTempoMarking(bpm: number): string {
  if (bpm < 40) return 'Grave';
  if (bpm < 60) return 'Lento';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}
