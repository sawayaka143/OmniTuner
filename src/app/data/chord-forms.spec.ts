import { describe, expect, it } from 'vitest';

import { CHORD_FORMULAS, parseChord, parseTuning, ParsedChord } from '../utils/chord-theory';
import {
  instantiateForm,
  requiredExtensionChoices,
  requiredPitchClasses,
} from '../utils/chord-voicing';
import { CHORD_FORMS, ChordForm } from './chord-forms';

const STANDARD = parseTuning('E2 A2 D3 G3 B3 E4');
if (!STANDARD.ok) throw new Error('failed to parse standard tuning');

const mod12 = (value: number): number => ((value % 12) + 12) % 12;

// Mirrors how the parser builds a chord from a formula, so the checks below run against the
// same pitch-class view the engine sees.
const chordFor = (quality: string, rootPc: number): ParsedChord => {
  const formula = CHORD_FORMULAS[quality];
  return {
    symbol: quality,
    rootPc,
    quality,
    intervals: formula.intervals,
    pcs: formula.intervals.map((interval) => mod12(rootPc + interval)),
    optionalPcs: (formula.optional ?? []).map((interval) => mod12(rootPc + interval)),
    flats: false,
  };
};

const formById = (id: string): ChordForm => {
  const form = CHORD_FORMS.find((candidate) => candidate.id === id);
  if (!form) throw new Error(`missing form ${id}`);
  return form;
};

describe('chord form library', () => {
  it('describes six-string grips with unique ids', () => {
    const ids = new Set<string>();
    for (const form of CHORD_FORMS) {
      expect(form.offsets.length, form.id).toBe(6);
      expect(form.anchor, form.id).toBeGreaterThanOrEqual(0);
      expect(form.anchor, form.id).toBeLessThan(6);
      expect(form.weight, form.id).toBeGreaterThan(0);
      expect(form.qualities.length, form.id).toBeGreaterThan(0);
      expect(ids.has(form.id), `${form.id} is duplicated`).toBe(false);
      ids.add(form.id);
    }
  });

  it('only names qualities the chord parser knows', () => {
    for (const form of CHORD_FORMS) {
      for (const quality of form.qualities) {
        expect(CHORD_FORMULAS, `${form.id} -> ${quality}`).toHaveProperty(quality);
      }
    }
  });

  // The load-bearing test: every grip must spell a real chord of its quality in all twelve
  // keys, which is what catches a mistyped offset.
  it('spells the declared quality in every key', () => {
    for (const form of CHORD_FORMS) {
      for (const quality of form.qualities) {
        for (let rootPc = 0; rootPc < 12; rootPc++) {
          const diagram = instantiateForm(form, STANDARD.tuning, rootPc);
          if (!diagram) continue;
          const chord = chordFor(quality, rootPc);
          const label = `${form.id} ${quality} root ${rootPc}`;

          const sounding = new Set<number>();
          for (let i = 0; i < diagram.length; i++) {
            const fret = diagram[i];
            if (fret === null) continue;
            expect(fret, label).toBeGreaterThanOrEqual(0);
            sounding.add(mod12(STANDARD.tuning.midi[i] + fret));
          }
          expect(sounding.size, label).toBeGreaterThanOrEqual(3);

          const chordPcs = new Set(chord.pcs);
          for (const pc of sounding)
            expect(chordPcs.has(pc), `${label} foreign pc ${pc}`).toBe(true);
          for (const pc of requiredPitchClasses(chord))
            expect(sounding.has(pc), `${label} missing required pc ${pc}`).toBe(true);
          const extensions = requiredExtensionChoices(chord);
          if (extensions.length)
            expect(
              extensions.some((pc) => sounding.has(pc)),
              `${label} missing every extension`,
            ).toBe(true);
        }
      }
    }
  });

  it('reproduces the shapes the owner plays, in the key they were given in', () => {
    const cases: readonly [string, string, readonly (number | null)[]][] = [
      ['Eb', 'maj-a', [null, 6, 8, 8, 8, 6]],
      ['F#maj7', 'maj7-a', [null, 9, 11, 10, 11, 9]],
      ['F#maj7', 'maj7-e', [2, null, 3, 3, 2, null]],
      ['Gmaj7', 'maj7-e', [3, null, 4, 4, 3, null]],
      ['B7b13', '7b13-e', [7, null, 7, 8, 8, null]],
      ['G13', '13-e', [3, null, 3, 4, 5, null]],
      ['Dm7b5', 'm7b5-a', [null, 5, 6, 5, 6, null]],
    ];
    for (const [symbol, id, expected] of cases) {
      const parsed = parseChord(symbol);
      if (!parsed.ok) throw new Error(`failed to parse ${symbol}`);
      expect(instantiateForm(formById(id), STANDARD.tuning, parsed.chord.rootPc), symbol).toEqual(
        expected,
      );
    }
  });

  it('declines tunings it was not written for', () => {
    const ukulele = parseTuning('G4 C4 E4 A4');
    const seven = parseTuning('B1 E2 A2 D3 G3 B3 E4');
    if (!ukulele.ok || !seven.ok) throw new Error('failed to parse non-guitar tunings');
    for (const form of CHORD_FORMS) {
      expect(instantiateForm(form, ukulele.tuning, 0), form.id).toBeNull();
      expect(instantiateForm(form, seven.tuning, 0), form.id).toBeNull();
    }
  });

  it('declines keys where the grip would run off the neck', () => {
    // The A-shape needs two frets above the anchor, so Ab would reach fret 13.
    expect(instantiateForm(formById('maj-a'), STANDARD.tuning, 8)).toBeNull();
    expect(instantiateForm(formById('maj-a'), STANDARD.tuning, 7)).not.toBeNull();
  });
});
