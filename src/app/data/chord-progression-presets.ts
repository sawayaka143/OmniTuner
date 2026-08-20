import type { ModeName } from '../utils/chord-theory';

export type Tonality = 'major' | 'minor' | 'both';

export interface ProgressionPreset {
  readonly id: string;
  readonly name: string;
  readonly degrees: readonly string[];
  readonly tonality: Tonality;
  readonly mode?: ModeName;
}

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  {
    id: 'pop-iv-vi-iv',
    name: 'Pop — I-V-vi-IV',
    degrees: ['I', 'V', 'vi', 'IV'],
    tonality: 'major',
  },
  { id: 'pop-iv-v', name: 'Pop — I-IV-V', degrees: ['I', 'IV', 'V'], tonality: 'major' },
  { id: 'pop-v-iv', name: 'Pop — I-V-IV', degrees: ['I', 'V', 'IV'], tonality: 'major' },
  {
    id: 'pop-iv-vi-v',
    name: 'Pop — I-IV-vi-V',
    degrees: ['I', 'IV', 'vi', 'V'],
    tonality: 'major',
  },
  {
    id: 'pop-vi-iv-i-v',
    name: 'Emotional — vi-IV-I-V',
    degrees: ['vi', 'IV', 'I', 'V'],
    tonality: 'major',
  },
  {
    id: 'pop-50s',
    name: 'Doo-wop — I-vi-IV-V',
    degrees: ['I', 'vi', 'IV', 'V'],
    tonality: 'major',
  },
  {
    id: 'pop-vi-ii-v',
    name: 'Jazz/Pop — I-vi-ii-V',
    degrees: ['I', 'vi', 'ii', 'V'],
    tonality: 'major',
  },
  {
    id: 'pop-ext',
    name: 'Extended pop — I-V-vi-iii-IV-I',
    degrees: ['I', 'V', 'vi', 'iii', 'IV', 'I'],
    tonality: 'major',
  },
  { id: 'pop-iv-i-v', name: 'Folk — I-IV-I-V', degrees: ['I', 'IV', 'I', 'V'], tonality: 'major' },

  {
    id: 'emo-vi-i-v-iv',
    name: 'Emotional — vi-I-V-IV',
    degrees: ['vi', 'I', 'V', 'IV'],
    tonality: 'major',
  },
  {
    id: 'emo-iii-iv-v',
    name: 'Emotional — I-iii-IV-V',
    degrees: ['I', 'iii', 'IV', 'V'],
    tonality: 'major',
  },
  {
    id: 'emo-iii-vi-iv',
    name: 'Emotional — I-iii-vi-IV',
    degrees: ['I', 'iii', 'vi', 'IV'],
    tonality: 'major',
  },
  {
    id: 'emo-vi-iii-iv',
    name: 'Emotional — I-vi-iii-IV',
    degrees: ['I', 'vi', 'iii', 'IV'],
    tonality: 'major',
  },
  {
    id: 'emo-iv-i-v-vi',
    name: 'Emotional — IV-I-V-vi',
    degrees: ['IV', 'I', 'V', 'vi'],
    tonality: 'major',
  },
  {
    id: 'emo-iv-v-iii-vi',
    name: 'Emotional — IV-V-iii-vi',
    degrees: ['IV', 'V', 'iii', 'vi'],
    tonality: 'major',
  },
  {
    id: 'emo-vi-v-iv-v',
    name: 'Emotional — vi-V-IV-V',
    degrees: ['vi', 'V', 'IV', 'V'],
    tonality: 'major',
  },

  { id: 'rock-v-i-iv', name: 'Rock — I-V-I-IV', degrees: ['I', 'V', 'I', 'IV'], tonality: 'major' },
  {
    id: 'rock-bvii-iv-i',
    name: 'Rock — I-bVII-IV-I',
    degrees: ['I', 'bVII', 'IV', 'I'],
    tonality: 'major',
  },
  {
    id: 'rock-bvii-iv-v',
    name: 'Rock — I-bVII-IV-V',
    degrees: ['I', 'bVII', 'IV', 'V'],
    tonality: 'major',
  },
  {
    id: 'rock-biii-iv-i',
    name: 'Rock — I-bIII-IV-I',
    degrees: ['I', 'bIII', 'IV', 'I'],
    tonality: 'major',
  },
  {
    id: 'rock-iv-bvii-iv',
    name: 'Rock — I-IV-bVII-IV',
    degrees: ['I', 'IV', 'bVII', 'IV'],
    tonality: 'major',
  },
  {
    id: 'rock-bvi-bvii-i',
    name: 'Rock — I-bVI-bVII-I',
    degrees: ['I', 'bVI', 'bVII', 'I'],
    tonality: 'major',
  },
  {
    id: 'rock-bvii-bvi-bvii',
    name: 'Rock — I-bVII-bVI-bVII',
    degrees: ['I', 'bVII', 'bVI', 'bVII'],
    tonality: 'major',
  },

  {
    id: 'blues-12',
    name: 'Blues — I-I-IV-V-IV-I',
    degrees: ['I', 'I', 'IV', 'V', 'IV', 'I'],
    tonality: 'major',
  },
  {
    id: 'blues-iv-v-iv',
    name: 'Blues — I-IV-V-IV',
    degrees: ['I', 'IV', 'V', 'IV'],
    tonality: 'major',
  },
  {
    id: 'blues-i-iv-v',
    name: 'Blues — I-I-IV-V',
    degrees: ['I', 'I', 'IV', 'V'],
    tonality: 'major',
  },
  {
    id: 'blues-iv-i-iv-v',
    name: 'Blues — I-IV-I-IV-V-I',
    degrees: ['I', 'IV', 'I', 'IV', 'V', 'I'],
    tonality: 'major',
  },

  { id: 'jazz-ii-v-i', name: 'Jazz — ii-V-I', degrees: ['ii', 'V', 'I'], tonality: 'major' },
  {
    id: 'jazz-iii-vi-ii-v-i',
    name: 'Jazz — iii-vi-ii-V-I',
    degrees: ['iii', 'vi', 'ii', 'V', 'I'],
    tonality: 'major',
  },
  {
    id: 'jazz-i-vi-ii-v-i',
    name: 'Jazz — I-vi-ii-V-I',
    degrees: ['I', 'vi', 'ii', 'V', 'I'],
    tonality: 'major',
  },
  {
    id: 'jazz-ii-v-iii-vi',
    name: 'Jazz — ii-V-iii-vi',
    degrees: ['ii', 'V', 'iii', 'vi'],
    tonality: 'major',
  },
  {
    id: 'jazz-iii-vi-ii-v',
    name: 'Jazz — iii-vi-ii-V',
    degrees: ['iii', 'vi', 'ii', 'V'],
    tonality: 'major',
  },
  {
    id: 'jazz-i-vi7-ii-v',
    name: 'Jazz — I-VI7-ii-V',
    degrees: ['I', 'VI7', 'ii', 'V'],
    tonality: 'major',
  },
  {
    id: 'jazz-i-vi7-ii7-v7',
    name: 'Jazz — I-VI7-ii7-V7',
    degrees: ['I', 'VI7', 'ii7', 'V7'],
    tonality: 'major',
  },
  {
    id: 'jazz-ii7-v7-imaj7',
    name: 'Jazz — ii7-V7-Imaj7',
    degrees: ['ii7', 'V7', 'Imaj7'],
    tonality: 'major',
  },
  {
    id: 'jazz-ii7-v7-imaj7-vi7',
    name: 'Jazz — ii7-V7-Imaj7-VI7',
    degrees: ['ii7', 'V7', 'Imaj7', 'VI7'],
    tonality: 'major',
  },
  {
    id: 'jazz-imaj7-vi7-ii7-v7',
    name: 'Jazz — Imaj7-vi7-ii7-V7',
    degrees: ['Imaj7', 'vi7', 'ii7', 'V7'],
    tonality: 'major',
  },

  {
    id: 'sad-i-vi-iii-vii',
    name: 'Minor — i-VI-III-VII',
    degrees: ['i', 'VI', 'III', 'VII'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-vii-vi-vii',
    name: 'Minor — i-VII-VI-VII',
    degrees: ['i', 'VII', 'VI', 'VII'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-vi-vii-i',
    name: 'Minor — i-VI-VII-i',
    degrees: ['i', 'VI', 'VII', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-iv-vii-iii',
    name: 'Minor — i-iv-VII-III',
    degrees: ['i', 'iv', 'VII', 'III'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-iv-vi-v',
    name: 'Minor — i-iv-VI-V',
    degrees: ['i', 'iv', 'VI', 'V'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-vi-iv-v',
    name: 'Minor — i-VI-iv-V',
    degrees: ['i', 'VI', 'iv', 'V'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-iii-vii-vi',
    name: 'Minor — i-III-VII-VI',
    degrees: ['i', 'III', 'VII', 'VI'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-vii-iii-vi',
    name: 'Minor — i-VII-III-VI',
    degrees: ['i', 'VII', 'III', 'VI'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-iv-v-i',
    name: 'Minor — i-iv-V-i',
    degrees: ['i', 'iv', 'V', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'sad-i-vi-iii-vii-vi-iv-v',
    name: 'Minor — i-VI-III-VII-iv-V',
    degrees: ['i', 'VI', 'III', 'VII', 'iv', 'V'],
    tonality: 'minor',
    mode: 'Aeolian',
  },

  {
    id: 'dark-i-vi-iii-vii2',
    name: 'Dark — i-VI-III-VII',
    degrees: ['i', 'VI', 'III', 'VII'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-v-vi-iv',
    name: 'Dark — i-v-VI-iv',
    degrees: ['i', 'v', 'VI', 'iv'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-iii-vi-vii',
    name: 'Dark — i-III-VI-VII',
    degrees: ['i', 'III', 'VI', 'VII'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-iv-vi-iii',
    name: 'Dark — i-iv-VI-III',
    degrees: ['i', 'iv', 'VI', 'III'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-vi-vii-iii',
    name: 'Dark — i-VI-VII-III',
    degrees: ['i', 'VI', 'VII', 'III'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-bii-i',
    name: 'Dark — i-bII-i',
    degrees: ['i', 'bII', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-bii-vii-i',
    name: 'Dark — i-bII-VII-i',
    degrees: ['i', 'bII', 'VII', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'dark-i-bvi-bvii-i',
    name: 'Dark — i-bVI-bVII-i',
    degrees: ['i', 'bVI', 'bVII', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },

  {
    id: 'indie-i-v-iv-vi',
    name: 'Indie — I-V-IV-vi',
    degrees: ['I', 'V', 'IV', 'vi'],
    tonality: 'major',
  },
  {
    id: 'indie-i-iv-iii-vi',
    name: 'Indie — I-IV-iii-vi',
    degrees: ['I', 'IV', 'iii', 'vi'],
    tonality: 'major',
  },
  {
    id: 'indie-i-iii-iv-iv',
    name: 'Indie — I-iii-IV-iv',
    degrees: ['I', 'iii', 'IV', 'iv'],
    tonality: 'major',
  },
  {
    id: 'indie-i-bvii-iv',
    name: 'Indie — I-bVII-IV',
    degrees: ['I', 'bVII', 'IV'],
    tonality: 'major',
  },
  {
    id: 'indie-i-iv-bvii-i',
    name: 'Indie — I-IV-bVII-I',
    degrees: ['I', 'IV', 'bVII', 'I'],
    tonality: 'major',
  },
  {
    id: 'indie-i-v-bvii-iv',
    name: 'Indie — I-V-bVII-IV',
    degrees: ['I', 'V', 'bVII', 'IV'],
    tonality: 'major',
  },
  {
    id: 'indie-iv-i-iii-vi',
    name: 'Indie — IV-I-iii-vi',
    degrees: ['IV', 'I', 'iii', 'vi'],
    tonality: 'major',
  },
  {
    id: 'indie-i-vi-ii-iv',
    name: 'Indie — I-vi-ii-IV',
    degrees: ['I', 'vi', 'ii', 'IV'],
    tonality: 'major',
  },
  {
    id: 'indie-i-biii-iv-bvii',
    name: 'Indie — I-bIII-IV-bVII',
    degrees: ['I', 'bIII', 'IV', 'bVII'],
    tonality: 'major',
  },

  {
    id: 'dreamy-i-majvii-iv-i',
    name: 'Dreamy — I-majVII-IV-I',
    degrees: ['I', 'maj7', 'IV', 'I'],
    tonality: 'major',
  },
  {
    id: 'dreamy-i-vi-iii-iv2',
    name: 'Dreamy — I-vi-iii-IV',
    degrees: ['I', 'vi', 'iii', 'IV'],
    tonality: 'major',
  },
  {
    id: 'dreamy-iv-i-vi-v',
    name: 'Dreamy — IV-I-vi-V',
    degrees: ['IV', 'I', 'vi', 'V'],
    tonality: 'major',
  },
  {
    id: 'dreamy-i-iv-ii-v',
    name: 'Dreamy — I-IV-ii-V',
    degrees: ['I', 'IV', 'ii', 'V'],
    tonality: 'major',
  },
  {
    id: 'dreamy-vi-iv-i-v',
    name: 'Dreamy — vi-IV-I-V',
    degrees: ['vi', 'IV', 'I', 'V'],
    tonality: 'major',
  },
  {
    id: 'dreamy-i-v-iv-i',
    name: 'Dreamy — I-V-IV-I',
    degrees: ['I', 'V', 'IV', 'I'],
    tonality: 'major',
  },

  {
    id: 'chrom-bvi-iv-v',
    name: 'Borrowed — I-bVI-IV-V',
    degrees: ['I', 'bVI', 'IV', 'V'],
    tonality: 'major',
  },
  {
    id: 'chrom-biii-iv-i',
    name: 'Borrowed — I-bIII-IV-I',
    degrees: ['I', 'bIII', 'IV', 'I'],
    tonality: 'major',
  },
  {
    id: 'chrom-iv-iv-i',
    name: 'Borrowed — I-IV-iv-I',
    degrees: ['I', 'IV', 'iv', 'I'],
    tonality: 'major',
  },
  {
    id: 'chrom-v-bvi-iv',
    name: 'Borrowed — I-V-bVI-IV',
    degrees: ['I', 'V', 'bVI', 'IV'],
    tonality: 'major',
  },
  {
    id: 'chrom-bvi-bvii-i',
    name: 'Borrowed — I-bVI-bVII-I',
    degrees: ['I', 'bVI', 'bVII', 'I'],
    tonality: 'major',
  },
  {
    id: 'chrom-bvi-bvii-i2',
    name: 'Borrowed — i-bVI-bVII-i',
    degrees: ['i', 'bVI', 'bVII', 'i'],
    tonality: 'minor',
    mode: 'Aeolian',
  },
  {
    id: 'chrom-bvii-bvi-v',
    name: 'Borrowed — I-bVII-bVI-V',
    degrees: ['I', 'bVII', 'bVI', 'V'],
    tonality: 'major',
  },
  {
    id: 'chrom-iii-iv-iv',
    name: 'Borrowed — I-III-IV-iv',
    degrees: ['I', 'III', 'IV', 'iv'],
    tonality: 'major',
  },
  {
    id: 'chrom-vi-bvii-iv',
    name: 'Borrowed — I-vi-bVII-IV',
    degrees: ['I', 'vi', 'bVII', 'IV'],
    tonality: 'major',
  },

  {
    id: 'top-10-4',
    name: 'Top 10 — I-IV-iv-I',
    degrees: ['I', 'IV', 'iv', 'I'],
    tonality: 'major',
  },
];
