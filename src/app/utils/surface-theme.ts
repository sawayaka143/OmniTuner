export type SurfaceTheme = 'light' | 'dark';

export interface SurfaceOverrides {
  readonly canvas: string | null;
  readonly card: string | null;
  readonly well: string | null;
  readonly pill: string | null;
}

const CARD_MIX: Readonly<
  Record<SurfaceTheme, { readonly into: string; readonly percent: number }>
> = {
  dark: { into: 'white', percent: 97.5 },
  light: { into: 'white', percent: 29 },
};

const ELEVATION_MIX: Readonly<
  Record<SurfaceTheme, { readonly into: string; readonly well: number; readonly pill: number }>
> = {
  dark: { into: 'white', well: 95.7, pill: 91.3 },
  light: { into: 'black', well: 92.8, pill: 88.5 },
};

const mix = (color: string, percent: number, into: string): string =>
  `color-mix(in srgb, ${color} ${percent}%, ${into})`;

export function surfaceOverrides(
  bgColor: string | null,
  cardColor: string | null,
  theme: SurfaceTheme,
): SurfaceOverrides {
  if (!bgColor && !cardColor) {
    return { canvas: null, card: null, well: null, pill: null };
  }

  const cardMix = CARD_MIX[theme];
  const elevationMix = ELEVATION_MIX[theme];
  const card = cardColor ?? (bgColor ? mix(bgColor, cardMix.percent, cardMix.into) : null);

  return {
    canvas: bgColor ?? null,
    card,
    well: card ? mix(card, elevationMix.well, elevationMix.into) : null,
    pill: card ? mix(card, elevationMix.pill, elevationMix.into) : null,
  };
}

const SURFACE_VARS = [
  '--canvas',
  '--surface-container-low',
  '--surface-container',
  '--surface-container-high',
] as const;

export function applySurfaceOverrides(
  style: CSSStyleDeclaration,
  overrides: SurfaceOverrides,
): void {
  const values: readonly (string | null)[] = [
    overrides.canvas,
    overrides.card,
    overrides.well,
    overrides.pill,
  ];
  SURFACE_VARS.forEach((property, index) => {
    const value = values[index];
    if (value) style.setProperty(property, value);
    else style.removeProperty(property);
  });
}
