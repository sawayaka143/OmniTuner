import { describe, expect, it } from 'vitest';
import { applySurfaceOverrides, surfaceOverrides } from './surface-theme';

describe('surfaceOverrides', () => {
  it('returns no overrides when both colors are default', () => {
    expect(surfaceOverrides(null, null, 'dark')).toEqual({
      canvas: null,
      card: null,
      well: null,
      pill: null,
    });
  });

  it('derives a brighter card from a custom background in the dark theme', () => {
    const overrides = surfaceOverrides('#1a1a2e', null, 'dark');
    expect(overrides.canvas).toBe('#1a1a2e');
    expect(overrides.card).toBe('color-mix(in srgb, #1a1a2e 97.5%, white)');
    expect(overrides.well).toBe('color-mix(in srgb, color-mix(in srgb, #1a1a2e 97.5%, white) 95.7%, white)');
    expect(overrides.pill).toBe('color-mix(in srgb, color-mix(in srgb, #1a1a2e 97.5%, white) 91.3%, white)');
  });

  it('uses light-theme mixing when the background is customized', () => {
    const overrides = surfaceOverrides('#f1f0ec', null, 'light');
    expect(overrides.card).toBe('color-mix(in srgb, #f1f0ec 29%, white)');
    expect(overrides.well).toBe('color-mix(in srgb, color-mix(in srgb, #f1f0ec 29%, white) 92.8%, black)');
    expect(overrides.pill).toBe('color-mix(in srgb, color-mix(in srgb, #f1f0ec 29%, white) 88.5%, black)');
  });

  it('uses the custom card color for the card surface', () => {
    const overrides = surfaceOverrides(null, '#24243e', 'dark');
    expect(overrides.canvas).toBeNull();
    expect(overrides.card).toBe('#24243e');
    expect(overrides.well).toBe('color-mix(in srgb, #24243e 95.7%, white)');
    expect(overrides.pill).toBe('color-mix(in srgb, #24243e 91.3%, white)');
  });

  it('prefers the custom card color over the derived one', () => {
    const overrides = surfaceOverrides('#1a1a2e', '#24243e', 'light');
    expect(overrides.canvas).toBe('#1a1a2e');
    expect(overrides.card).toBe('#24243e');
    expect(overrides.well).toBe('color-mix(in srgb, #24243e 92.8%, black)');
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
      card: 'color-mix(in srgb, #101020 97.5%, white)',
      well: null,
      pill: null,
    });
    expect(style.vars.get('--canvas')).toBe('#101020');
    expect(style.vars.get('--surface-container-low')).toBe(
      'color-mix(in srgb, #101020 97.5%, white)',
    );
    expect(style.vars.has('--surface-container')).toBe(false);
    expect(style.vars.has('--surface-container-high')).toBe(false);
  });
});
