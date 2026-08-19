/**
 * Guard: the text color tokens shipped in src/styles.scss must clear 4.5:1
 * (WCAG AA) against every surface token. Values are kept in sync with
 * styles.scss — the guard catches regressions that would silently fail
 * contrast for micro-labels, dropdown groups and rail captions.
 * KEEP IN SYNC — src/styles.scss:5-18 (and --canvas/surface-* tokens).
 */
const TEXT_TOKENS: Record<string, string> = {
  '--text': '#f5f5f3',
  '--text-muted': '#9a9a94',
  '--text-dim': '#94948e',
};

const SURFACE_TOKENS: Record<string, string> = {
  '--canvas': '#121211',
  '--surface-container-low': '#181817',
  '--surface-container': '#222220',
  '--surface-container-high': '#2c2c29',
};

const AA_MIN = 4.5;

function hexToLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const linear = (v: number): number =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [hexToLuminance(a), hexToLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('color token contrast (WCAG AA)', () => {
  it('text tokens are defined', () => {
    expect(Object.keys(TEXT_TOKENS).length).toBeGreaterThan(0);
  });

  for (const [textName, textHex] of Object.entries(TEXT_TOKENS)) {
    for (const [surfaceName, surfaceHex] of Object.entries(SURFACE_TOKENS)) {
      it(`${textName} (#${textHex.replace('#', '')}) vs ${surfaceName} >= ${AA_MIN}:1`, () => {
        expect(contrastRatio(textHex, surfaceHex)).toBeGreaterThanOrEqual(AA_MIN);
      });
    }
  }
});
