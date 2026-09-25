import { describe, expect, it } from 'vitest';
import { applySurfaceOverrides, readableInk, surfaceOverrides } from './surface-theme';

describe('surfaceOverrides', () => {
  it('returns no overrides when both colors are default', () => {
    expect(surfaceOverrides(null, null, 'dark')).toEqual({
      canvas: null,
      card: null,
      well: null,
      pill: null,
      text: null,
      textMuted: null,
      textDim: null,
    });
  });

  it('keeps card surfaces at theme defaults when only the background is customized', () => {
    const overrides = surfaceOverrides('#1a1a2e', null, 'dark');
    expect(overrides.canvas).toBe('#1a1a2e');
    expect(overrides.card).toBeNull();
    expect(overrides.well).toBeNull();
    expect(overrides.pill).toBeNull();
  });

  it('derives elevation surfaces from a custom card color in the dark theme', () => {
    const overrides = surfaceOverrides(null, '#24243e', 'dark');
    expect(overrides.canvas).toBeNull();
    expect(overrides.card).toBe('#24243e');
    expect(overrides.well).toBe('color-mix(in srgb, #24243e 95.7%, white)');
    expect(overrides.pill).toBe('color-mix(in srgb, #24243e 91.3%, white)');
  });

  it('derives elevation surfaces from a custom card color in the light theme', () => {
    const overrides = surfaceOverrides(null, '#24243e', 'light');
    expect(overrides.well).toBe('color-mix(in srgb, #24243e 92.8%, black)');
    expect(overrides.pill).toBe('color-mix(in srgb, #24243e 88.5%, black)');
  });

  it('uses the custom background for the canvas and the ink when both colors are set', () => {
    const overrides = surfaceOverrides('#1a1a2e', '#24243e', 'light');
    expect(overrides.canvas).toBe('#1a1a2e');
    expect(overrides.card).toBe('#24243e');
    expect(overrides.well).toBe('color-mix(in srgb, #24243e 92.8%, black)');
    expect(overrides.text).toBe('#f5f5f3');
    expect(overrides.textMuted).toBe('color-mix(in srgb, #f5f5f3 75%, #1a1a2e)');
    expect(overrides.textDim).toBe('color-mix(in srgb, #f5f5f3 65%, #1a1a2e)');
  });

  it('skips ink overrides when the background is not a usable hex color', () => {
    const overrides = surfaceOverrides('blue', null, 'dark');
    expect(overrides.canvas).toBe('blue');
    expect(overrides.text).toBeNull();
    expect(overrides.textMuted).toBeNull();
    expect(overrides.textDim).toBeNull();
  });
});

describe('readableInk', () => {
  it('returns the light ink on dark surfaces', () => {
    expect(readableInk('#1a1a2e')).toBe('#f5f5f3');
  });

  it('returns the dark ink on light surfaces', () => {
    expect(readableInk('#f1f0ec')).toBe('#121211');
  });

  it('blends the ink until it reaches AA contrast on mid-tone surfaces', () => {
    expect(readableInk('#757575')).toBe('#fdfdfd');
  });

  it('returns null for non-hex colors', () => {
    expect(readableInk('blue')).toBeNull();
    expect(readableInk('#12345')).toBeNull();
  });
});

describe('applySurfaceOverrides', () => {
  const createStyle = (): CSSStyleDeclaration & { vars: Map<string, string> } => {
    const vars = new Map<string, string>();
    return {
      vars,
      setProperty: (name: string, value: string): void => {
        vars.set(name, value);
      },
      removeProperty: (name: string): void => {
        vars.delete(name);
      },
    } as CSSStyleDeclaration & { vars: Map<string, string> };
  };

  it('sets and removes custom properties', () => {
    const style = createStyle();
    applySurfaceOverrides(style, {
      canvas: '#101020',
      card: '#181828',
      well: null,
      pill: null,
      text: '#f5f5f3',
      textMuted: 'color-mix(in srgb, #f5f5f3 75%, #101020)',
      textDim: null,
    });
    expect(style.vars.get('--canvas')).toBe('#101020');
    expect(style.vars.get('--surface-container-low')).toBe('#181828');
    expect(style.vars.has('--surface-container')).toBe(false);
    expect(style.vars.has('--surface-container-high')).toBe(false);
    expect(style.vars.get('--text')).toBe('#f5f5f3');
    expect(style.vars.get('--text-muted')).toBe('color-mix(in srgb, #f5f5f3 75%, #101020)');
    expect(style.vars.has('--text-dim')).toBe(false);
  });
});
