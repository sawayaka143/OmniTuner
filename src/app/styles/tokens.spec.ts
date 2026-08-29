import { readFileSync } from 'node:fs';

const stylesheet = readFileSync(`${process.cwd()}/src/styles.scss`, 'utf8');

const AA_MIN = 4.5;

const DARK_TEXT_TOKENS: Record<string, string> = {
  '--text': '#f5f5f3',
  '--text-muted': '#9a9a94',
  '--text-dim': '#94948e',
};

const DARK_SURFACE_TOKENS: Record<string, string> = {
  '--canvas': '#121211',
  '--surface-container-low': '#181817',
  '--surface-container': '#222220',
  '--surface-container-high': '#2c2c29',
};

const LIGHT_TEXT_TOKENS: Record<string, string> = {
  '--text': '#1a1a18',
  '--text-muted': '#54544f',
  '--text-dim': '#5f5f5b',
};

const LIGHT_SURFACE_TOKENS: Record<string, string> = {
  '--canvas': '#f1f0ec',
  '--surface-container-low': '#fbfaf8',
  '--surface-container': '#e9e7e2',
  '--surface-container-high': '#dedbd4',
};

const LIGHT_SEMANTIC_TOKENS: Record<string, string> = {
  '--good': '#11603c',
  '--warn': '#8a4d00',
  '--info': '#544a8f',
  '--danger': '#b01645',
  '--danger-hover': '#8f1138',
};

const ACCENT_EXTREMES: readonly string[] = [
  '#ede8d0',
  '#ffffff',
  '#000000',
  '#1a1a18',
  '#7ecba8',
  '#ffdd00',
  '#ff0000',
  '#0000ff',
];

function parseTokenBlock(source: string, selector: string): Record<string, string> {
  const selectorAt = source.indexOf(selector);
  if (selectorAt === -1) return {};
  const open = source.indexOf('{', selectorAt);
  if (open === -1) return {};

  let depth = 1;
  let cursor = open;
  while (depth > 0 && cursor < source.length - 1) {
    cursor += 1;
    if (source[cursor] === '{') depth += 1;
    else if (source[cursor] === '}') depth -= 1;
  }

  const body = source.slice(open + 1, cursor);
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[`--${match[1]}`] = match[2].trim();
  }
  return tokens;
}

interface AccentMix {
  readonly ratio: number;
  readonly base: string;
}

function accentMixFrom(declared: Record<string, string>, theme: string): AccentMix {
  const declaration = declared['--accent-text'];
  const match = declaration
    ? /color-mix\(in srgb,\s*var\(--scale-accent\)\s*(\d+)%,\s*(#[0-9a-fA-F]{6})\)/.exec(declaration)
    : null;
  if (!match) {
    throw new Error(`--accent-text color-mix declaration missing or unsupported (${theme} theme)`);
  }
  return { ratio: Number(match[1]) / 100, base: match[2].toLowerCase() };
}

const DARK_DECLARED = parseTokenBlock(stylesheet, ':root');
const LIGHT_DECLARED = parseTokenBlock(stylesheet, "html[data-theme='light']");
const ACCENT_TEXT_MIX = {
  light: accentMixFrom(LIGHT_DECLARED, 'light'),
  dark: accentMixFrom(DARK_DECLARED, 'dark'),
};

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

function hexToLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const linear = (v: number): number =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [hexToLuminance(a), hexToLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mixHex(a: string, b: string, ratio: number): string {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  const mix = (x: number, y: number): number => Math.round(x * ratio + y * (1 - ratio));
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(ra, rb))}${toHex(mix(ga, gb))}${toHex(mix(ba, bb))}`;
}

describe('color token contrast (WCAG AA)', () => {
  describe('stylesheet cross-check (src/styles.scss)', () => {
    it('parses both theme blocks from the stylesheet', () => {
      expect(Object.keys(DARK_DECLARED).length, 'dark :root block').toBeGreaterThan(0);
      expect(Object.keys(LIGHT_DECLARED).length, 'light theme block').toBeGreaterThan(0);
    });

    it('declares the dark tokens under test', () => {
      const defined: Record<string, string> = { ...DARK_TEXT_TOKENS, ...DARK_SURFACE_TOKENS };
      for (const [name, hex] of Object.entries(defined)) {
        expect(DARK_DECLARED[name], `${name} (dark)`).toBe(hex);
      }
    });

    it('declares the light tokens under test', () => {
      const defined: Record<string, string> = {
        ...LIGHT_TEXT_TOKENS,
        ...LIGHT_SURFACE_TOKENS,
        ...LIGHT_SEMANTIC_TOKENS,
      };
      for (const [name, hex] of Object.entries(defined)) {
        expect(LIGHT_DECLARED[name], `${name} (light)`).toBe(hex);
      }
    });

    it('mixes --accent-text over the theme text base', () => {
      expect(ACCENT_TEXT_MIX.dark.base).toBe(DARK_TEXT_TOKENS['--text']);
      expect(ACCENT_TEXT_MIX.light.base).toBe(LIGHT_TEXT_TOKENS['--text']);
    });
  });

  describe('dark theme (:root)', () => {
    for (const [textName, textHex] of Object.entries(DARK_TEXT_TOKENS)) {
      for (const [surfaceName, surfaceHex] of Object.entries(DARK_SURFACE_TOKENS)) {
        it(`${textName} (#${textHex.replace('#', '')}) vs ${surfaceName} >= ${AA_MIN}:1`, () => {
          expect(contrastRatio(textHex, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
        });
      }
    }
  });

  describe('light theme (html[data-theme="light"])', () => {
    for (const [textName, textHex] of Object.entries(LIGHT_TEXT_TOKENS)) {
      for (const [surfaceName, surfaceHex] of Object.entries(LIGHT_SURFACE_TOKENS)) {
        it(`${textName} (#${textHex.replace('#', '')}) vs ${surfaceName} >= ${AA_MIN}:1`, () => {
          expect(contrastRatio(textHex, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
        });
      }
    }

    for (const [textName, textHex] of Object.entries(LIGHT_SEMANTIC_TOKENS)) {
      for (const [surfaceName, surfaceHex] of Object.entries(LIGHT_SURFACE_TOKENS)) {
        it(`${textName} (#${textHex.replace('#', '')}) vs ${surfaceName} >= ${AA_MIN}:1`, () => {
          expect(contrastRatio(textHex, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
        });
      }
    }
  });

  describe('--accent-text re-inking holds AA for any user accent', () => {
    const { light, dark } = ACCENT_TEXT_MIX;

    for (const accent of ACCENT_EXTREMES) {
      const lightMixed = mixHex(accent, light.base, light.ratio);
      for (const [surfaceName, surfaceHex] of Object.entries(LIGHT_SURFACE_TOKENS)) {
        it(`light mix of ${accent} vs ${surfaceName} >= ${AA_MIN}:1`, () => {
          expect(contrastRatio(lightMixed, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
        });
      }

      const darkMixed = mixHex(accent, dark.base, dark.ratio);
      for (const [surfaceName, surfaceHex] of Object.entries(DARK_SURFACE_TOKENS)) {
        it(`dark mix of ${accent} vs ${surfaceName} >= ${AA_MIN}:1`, () => {
          expect(contrastRatio(darkMixed, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
        });
      }
    }
  });
});
