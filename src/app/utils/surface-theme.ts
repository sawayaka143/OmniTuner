export type SurfaceTheme = 'light' | 'dark';

export interface SurfaceOverrides {
  readonly canvas: string | null;
  readonly card: string | null;
  readonly well: string | null;
  readonly pill: string | null;
  readonly text: string | null;
  readonly textMuted: string | null;
  readonly textDim: string | null;
}

type Rgb = readonly [number, number, number];

const ELEVATION_MIX: Readonly<
  Record<SurfaceTheme, { readonly into: string; readonly well: number; readonly pill: number }>
> = {
  dark: { into: 'white', well: 95.7, pill: 91.3 },
  light: { into: 'black', well: 92.8, pill: 88.5 },
};

const LIGHT_INK = '#f5f5f3';
const DARK_INK = '#121211';
const MIN_CONTRAST = 4.5;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

const mix = (color: string, percent: number, into: string): string =>
  `color-mix(in srgb, ${color} ${percent}%, ${into})`;

const parseHex = (hex: string): Rgb | null => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const toLinear = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminance = (rgb: Rgb): number =>
  0.2126 * toLinear(rgb[0] / 255) +
  0.7152 * toLinear(rgb[1] / 255) +
  0.0722 * toLinear(rgb[2] / 255);

const contrastRatio = (a: Rgb, b: Rgb): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const rgbToHex = (rgb: Rgb): string =>
  `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const blend = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

export function readableInk(surface: string): string | null {
  const surfaceRgb = parseHex(surface);
  if (!surfaceRgb) return null;
  const lightInk = parseHex(LIGHT_INK) as Rgb;
  const darkInk = parseHex(DARK_INK) as Rgb;

  const lightContrast = contrastRatio(lightInk, surfaceRgb);
  const darkContrast = contrastRatio(darkInk, surfaceRgb);
  const preferLight = lightContrast >= darkContrast;
  const base = preferLight ? lightInk : darkInk;
  const target = preferLight ? WHITE : BLACK;

  if (contrastRatio(base, surfaceRgb) >= MIN_CONTRAST) return rgbToHex(base);

  let fallback = rgbToHex(base);
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = blend(base, target, amount);
    fallback = rgbToHex(candidate);
    if (contrastRatio(candidate, surfaceRgb) >= MIN_CONTRAST) return fallback;
  }
  return fallback;
}

function inkOverrides(
  bgColor: string | null,
): Pick<SurfaceOverrides, 'text' | 'textMuted' | 'textDim'> | null {
  if (!bgColor) return null;
  const ink = readableInk(bgColor);
  if (!ink) return null;
  return {
    text: ink,
    textMuted: mix(ink, 75, bgColor),
    textDim: mix(ink, 65, bgColor),
  };
}

export function surfaceOverrides(
  bgColor: string | null,
  cardColor: string | null,
  theme: SurfaceTheme,
): SurfaceOverrides {
  const card = cardColor ?? null;
  const elevation = ELEVATION_MIX[theme];
  const ink = inkOverrides(bgColor);

  return {
    canvas: bgColor ?? null,
    card,
    well: card ? mix(card, elevation.well, elevation.into) : null,
    pill: card ? mix(card, elevation.pill, elevation.into) : null,
    text: ink?.text ?? null,
    textMuted: ink?.textMuted ?? null,
    textDim: ink?.textDim ?? null,
  };
}

export function applySurfaceOverrides(
  style: CSSStyleDeclaration,
  overrides: SurfaceOverrides,
): void {
  const values: ReadonlyArray<readonly [string, string | null]> = [
    ['--canvas', overrides.canvas],
    ['--surface-container-low', overrides.card],
    ['--surface-container', overrides.well],
    ['--surface-container-high', overrides.pill],
    ['--text', overrides.text],
    ['--text-muted', overrides.textMuted],
    ['--text-dim', overrides.textDim],
  ];

  for (const [property, value] of values) {
    if (value) style.setProperty(property, value);
    else style.removeProperty(property);
  }
}
