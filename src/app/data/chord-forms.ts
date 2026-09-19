export interface ChordForm {
  readonly id: string;
  /** ParsedChord.quality keys this grip is the standard shape for. */
  readonly qualities: readonly string[];
  /** String index carrying the root (0 = lowest string in tuning order). */
  readonly anchor: number;
  /**
   * Fret offsets from the anchor fret. `null` mutes the string and `0` means
   * *at the anchor fret* — never a literal open string. Negatives are allowed.
   */
  readonly offsets: readonly (number | null)[];
  /** Score bonus when this exact diagram is produced. */
  readonly weight: number;
}

const FORM_WEIGHT = 36;

// Movable grips only: the engine already ranks the open shapes (C x32010, Em 022000,
// Am x02210) at the top, so these exist to make the transposable barre forms rank
// equally well in every key. Offsets are anchor-relative, so one entry covers all
// twelve keys; a grip reaching past MAX_FRET in a given key is skipped.
export const CHORD_FORMS: readonly ChordForm[] = [
  { id: 'maj-e', qualities: ['maj'], anchor: 0, offsets: [0, 2, 2, 1, 0, 0], weight: FORM_WEIGHT },
  {
    id: 'maj-a',
    qualities: ['maj'],
    anchor: 1,
    offsets: [null, 0, 2, 2, 2, 0],
    weight: FORM_WEIGHT,
  },
  { id: 'min-em', qualities: ['min'], anchor: 0, offsets: [0, 2, 2, 0, 0, 0], weight: FORM_WEIGHT },
  {
    id: 'min-am',
    qualities: ['min'],
    anchor: 1,
    offsets: [null, 0, 2, 2, 1, 0],
    weight: FORM_WEIGHT,
  },
  { id: '7-e', qualities: ['7'], anchor: 0, offsets: [0, 2, 0, 1, 0, 0], weight: FORM_WEIGHT },
  { id: '7-a', qualities: ['7'], anchor: 1, offsets: [null, 0, 2, 0, 2, 0], weight: FORM_WEIGHT },
  {
    id: 'maj7-e',
    qualities: ['maj7'],
    anchor: 0,
    offsets: [0, null, 1, 1, 0, null],
    weight: FORM_WEIGHT,
  },
  {
    id: 'maj7-a',
    qualities: ['maj7'],
    anchor: 1,
    offsets: [null, 0, 2, 1, 2, 0],
    weight: FORM_WEIGHT,
  },
  { id: 'm7-em', qualities: ['m7'], anchor: 0, offsets: [0, 2, 0, 0, 0, 0], weight: FORM_WEIGHT },
  {
    id: 'm7-a',
    qualities: ['m7'],
    anchor: 1,
    offsets: [null, 0, 2, 0, 1, 0],
    weight: FORM_WEIGHT,
  },
  {
    id: 'm7b5-a',
    qualities: ['m7b5'],
    anchor: 1,
    offsets: [null, 0, 1, 0, 1, null],
    weight: FORM_WEIGHT,
  },
  {
    id: 'dim7-d',
    qualities: ['dim7'],
    anchor: 2,
    offsets: [null, null, 0, 1, 0, 1],
    weight: FORM_WEIGHT,
  },
  {
    id: '13-e',
    qualities: ['13'],
    anchor: 0,
    offsets: [0, null, 0, 1, 2, null],
    weight: FORM_WEIGHT,
  },
  {
    id: '7b13-e',
    qualities: ['7b13'],
    anchor: 0,
    offsets: [0, null, 0, 1, 1, null],
    weight: FORM_WEIGHT,
  },
];
