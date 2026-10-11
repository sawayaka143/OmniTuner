export interface ChordForm {
  readonly id: string;
  readonly qualities: readonly string[];
  readonly anchor: number;
  readonly offsets: readonly (number | null)[];
}

export const CHORD_FORMS: readonly ChordForm[] = [
  { id: 'maj-e', qualities: ['maj'], anchor: 0, offsets: [0, 2, 2, 1, 0, 0] },
  {
    id: 'maj-a',
    qualities: ['maj'],
    anchor: 1,
    offsets: [null, 0, 2, 2, 2, 0],
  },
  { id: 'min-em', qualities: ['min'], anchor: 0, offsets: [0, 2, 2, 0, 0, 0] },
  {
    id: 'min-am',
    qualities: ['min'],
    anchor: 1,
    offsets: [null, 0, 2, 2, 1, 0],
  },
  { id: '7-e', qualities: ['7'], anchor: 0, offsets: [0, 2, 0, 1, 0, 0] },
  { id: '7-a', qualities: ['7'], anchor: 1, offsets: [null, 0, 2, 0, 2, 0] },
  {
    id: 'maj7-e',
    qualities: ['maj7'],
    anchor: 0,
    offsets: [0, null, 1, 1, 0, null],
  },
  {
    id: 'maj7-a',
    qualities: ['maj7'],
    anchor: 1,
    offsets: [null, 0, 2, 1, 2, 0],
  },
  { id: 'm7-em', qualities: ['m7'], anchor: 0, offsets: [0, 2, 0, 0, 0, 0] },
  {
    id: 'm7-a',
    qualities: ['m7'],
    anchor: 1,
    offsets: [null, 0, 2, 0, 1, 0],
  },
  {
    id: 'm7b5-a',
    qualities: ['m7b5'],
    anchor: 1,
    offsets: [null, 0, 1, 0, 1, null],
  },
  {
    id: 'dim7-d',
    qualities: ['dim7'],
    anchor: 2,
    offsets: [null, null, 0, 1, 0, 1],
  },
  {
    id: '13-e',
    qualities: ['13'],
    anchor: 0,
    offsets: [0, null, 0, 1, 2, null],
  },
  {
    id: '7b13-e',
    qualities: ['7b13'],
    anchor: 0,
    offsets: [0, null, 0, 1, 1, null],
  },
];
