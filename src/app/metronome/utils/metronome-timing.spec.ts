import {
  barDuration,
  beatDuration,
  buildBarEvents,
  describeMeter,
  formatBarDuration,
  getTempoMarking,
  isBarAudible,
  meterModel,
  polyTimes,
  quarterDuration,
  subdivisionInterval,
  tapBpm,
  tickKind,
  ticksPerBar,
} from './metronome-timing';

describe('meterModel', () => {
  it('treats a simple meter as one beat per unit', () => {
    const model = meterModel(4, 4);

    expect(model.compound).toBe(false);
    expect(model.divisionsPerBeat).toBe(1);
    expect(model.beatsPerBar).toBe(4);
    expect(model.beatQuarters).toBe(1);
    expect(model.barQuarters).toBe(4);
  });

  it('groups compound meters into dotted beats', () => {
    const model = meterModel(6, 8);

    expect(model.compound).toBe(true);
    expect(model.divisionsPerBeat).toBe(3);
    expect(model.beatsPerBar).toBe(2);
    expect(model.barQuarters).toBe(3);
  });

  it('does not treat a small multiple of three as compound', () => {
    expect(meterModel(3, 4).compound).toBe(false);
    expect(meterModel(6, 4).compound).toBe(false);
  });
});

describe('describeMeter', () => {
  it('describes simple and compound meters differently', () => {
    expect(describeMeter(meterModel(4, 4))).toBe('4/4 — 4 quarter-note beats per bar');
    expect(describeMeter(meterModel(2, 4))).toBe('2/4 — 2 quarter-note beats per bar');
    expect(describeMeter(meterModel(6, 8))).toBe('Compound 6/8 — 2 dotted-eighth beats per bar');
  });

  it('falls back to a slash name for unusual denominators', () => {
    expect(describeMeter(meterModel(4, 32 as never))).toContain('1/32');
  });
});

describe('buildBarEvents', () => {
  it('emits a downbeat plus beats for a simple meter', () => {
    const events = buildBarEvents(meterModel(4, 4));

    expect(events.length).toBe(4);
    expect(events[0]).toMatchObject({ beats: 0, layer: 'meter', role: 'downbeat' });
    expect(events[1].role).toBe('beat');
  });

  it('inserts subdivision events between beats', () => {
    const events = buildBarEvents(meterModel(2, 4), { subdivision: 2 });

    expect(events.map((e) => e.role)).toEqual(['downbeat', 'subdivision', 'beat', 'subdivision']);
  });

  it('adds a polyrhythm layer and sorts by position', () => {
    const events = buildBarEvents(meterModel(4, 4), {
      poly: { enabled: true, events: 3, accentFirst: true },
    });

    expect(events.filter((e) => e.layer === 'poly').length).toBe(3);
    expect(events.find((e) => e.layer === 'poly')?.role).toBe('polyAccent');
    expect([...events].sort((a, b) => a.beats - b.beats)).toEqual(events);
  });

  it('ignores a disabled or empty polyrhythm', () => {
    expect(buildBarEvents(meterModel(2, 4), { poly: { enabled: false, events: 3 } }).length).toBe(
      2,
    );
    expect(buildBarEvents(meterModel(2, 4), { poly: { enabled: true, events: 0 } }).length).toBe(2);
  });
});

describe('durations', () => {
  it('converts tempo into quarter, beat, bar and subdivision intervals', () => {
    const model = meterModel(4, 4);

    expect(quarterDuration(60)).toBe(1);
    expect(beatDuration(60, model)).toBe(1);
    expect(barDuration(60, model)).toBe(4);
    expect(subdivisionInterval(120, model, 2)).toBe(0.25);
    expect(ticksPerBar(model, 2)).toBe(8);
  });
});

describe('tickKind', () => {
  it('classifies downbeats, beats and subdivisions', () => {
    expect(tickKind(0, 2)).toBe('downbeat');
    expect(tickKind(2, 2)).toBe('beat');
    expect(tickKind(3, 2)).toBe('subdivision');
  });
});

describe('polyTimes', () => {
  it('spreads the requested number of hits across the bar', () => {
    expect(polyTimes(10, 4, 4)).toEqual([10, 11, 12, 13]);
    expect(polyTimes(0, 4, 3)).toEqual([0, 4 / 3, 8 / 3]);
  });

  it('returns nothing for a non-positive count', () => {
    expect(polyTimes(0, 4, 0)).toEqual([]);
    expect(polyTimes(0, 4, -2)).toEqual([]);
  });
});

describe('isBarAudible', () => {
  it('follows the bar pattern cyclically', () => {
    expect(isBarAudible(0, [1, 0])).toBe(true);
    expect(isBarAudible(1, [1, 0])).toBe(false);
    expect(isBarAudible(4, [1, 0])).toBe(true);
  });

  it('treats an empty pattern as audible', () => {
    expect(isBarAudible(7, [])).toBe(true);
  });
});

describe('tapBpm', () => {
  it('averages plausible tap intervals', () => {
    expect(tapBpm([500, 500, 500])).toBe(120);
    expect(tapBpm([400, 600])).toBe(120);
  });

  it('ignores implausible intervals', () => {
    expect(tapBpm([50, 40])).toBeNull();
    expect(tapBpm([3000])).toBeNull();
    expect(tapBpm([])).toBeNull();
  });
});

describe('formatBarDuration', () => {
  it('uses milliseconds below a second and seconds above', () => {
    expect(formatBarDuration(400)).toBe('400 ms');
    expect(formatBarDuration(1500)).toBe('1.50 s');
  });
});

describe('getTempoMarking', () => {
  it('maps the full tempo range to markings', () => {
    expect(getTempoMarking(30)).toBe('Grave');
    expect(getTempoMarking(50)).toBe('Lento');
    expect(getTempoMarking(70)).toBe('Adagio');
    expect(getTempoMarking(90)).toBe('Andante');
    expect(getTempoMarking(110)).toBe('Moderato');
    expect(getTempoMarking(140)).toBe('Allegro');
    expect(getTempoMarking(180)).toBe('Presto');
    expect(getTempoMarking(240)).toBe('Prestissimo');
  });
});
