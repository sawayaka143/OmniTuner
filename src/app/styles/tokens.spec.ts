/**
 * Guard: the text color tokens shipped in src/styles.scss must clear 4.5:1
 * (WCAG AA) against every surface token they appear on — in BOTH themes.
 * Values are kept in sync with styles.scss — the guard catches regressions
 * that would silently fail contrast for micro-labels, dropdown groups, rail
 * captions, semantic status text and the theme-derived accent re-inking.
 * KEEP IN SYNC — src/styles.scss (`:root` dark block and light block).
 */
const AA_MIN = 4.5;

/** Dark theme tokens (`:root`). Also the light-theme tuner faceplate palette. */
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

/** Light theme tokens (`html[data-theme='light']`). */
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

/** Semantic status colors, light theme — used as text on canvas and cards. */
const LIGHT_SEMANTIC_TOKENS: Record<string, string> = {
  '--good': '#11603c',
  '--warn': '#8a4d00',
  '--info': '#544a8f',
  '--danger': '#b01645',
  '--danger-hover': '#8f1138',
};

/**
 * The themes re-ink the raw user accent into readable text via
 * `color-mix(in srgb, var(--scale-accent) <ratio>%, <base>)` (see --accent-text
 * in styles.scss). Raw accent stays reserved for fills, lamps and glows.
 * The mixes below replicate that math for the accent extremes a user can pick
 * in Settings.
 */
const ACCENT_TEXT_MIX = {
  light: { ratio: 0.3, base: '#1a1a18' },
  dark: { ratio: 0.4, base: '#f5f5f3' },
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

/** Replicates `color-mix(in srgb, a ratio%, b)` — gamma-encoded sRGB lerp. */
function mixHex(a: string, b: string, ratio: number): string {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  const mix = (x: number, y: number): number => Math.round(x * ratio + y * (1 - ratio));
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(ra, rb))}${toHex(mix(ga, gb))}${toHex(mix(ba, bb))}`;
}

describe('color token contrast (WCAG AA)', () => {
  it('text tokens are defined', () => {
    expect(Object.keys(DARK_TEXT_TOKENS).length).toBeGreaterThan(0);
    expect(Object.keys(LIGHT_TEXT_TOKENS).length).toBeGreaterThan(0);
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
