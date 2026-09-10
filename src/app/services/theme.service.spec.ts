import { TestBed } from '@angular/core/testing';

import { THEME_MEDIA_QUERY, THEME_STORAGE, THEME_STORAGE_KEY, ThemeService } from './theme.service';

class FakeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let mediaHandler: ((event: { matches: boolean }) => void) | null = null;

const stubMatchMedia = (prefersLight: boolean): void => {
  const impl = (): unknown => ({
    matches: prefersLight,
    addEventListener: (_: string, handler: (event: { matches: boolean }) => void): void => {
      mediaHandler = handler;
    },
    removeEventListener: (): void => {},
  });

  const view = globalThis.document?.defaultView as unknown as {
    matchMedia?: unknown;
  } | null;
  if (view) {
    Object.defineProperty(view, 'matchMedia', { configurable: true, writable: true, value: impl });
  }
  vi.stubGlobal('matchMedia', impl);
};

describe('ThemeService', () => {
  let storage: FakeStorage;

  const create = (prefersLight = false, stored: string | null = null): ThemeService => {
    if (stored !== null) storage.setItem(THEME_STORAGE_KEY, stored);
    stubMatchMedia(prefersLight);
    TestBed.configureTestingModule({
      providers: [{ provide: THEME_STORAGE, useValue: storage }],
    });
    return TestBed.inject(ThemeService);
  };

  const doc = (): Document => globalThis.document;

  beforeEach(() => {
    storage = new FakeStorage();
    mediaHandler = null;
    const meta = doc().createElement('meta');
    meta.setAttribute('name', 'theme-color');
    doc().head.appendChild(meta);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    for (const meta of [...doc().head.querySelectorAll('meta[name="theme-color"]')]) {
      meta.remove();
    }
  });

  it('defaults to dark when the system does not prefer light', () => {
    expect(create(false).theme()).toBe('dark');
  });

  it('defaults to light when the system prefers light', () => {
    expect(create(true).theme()).toBe('light');
  });

  it('reads a stored theme, including legacy plain-string values', () => {
    expect(create(false, '"light"').theme()).toBe('light');

    TestBed.resetTestingModule();
    expect(create(false, 'light').theme()).toBe('light');

    TestBed.resetTestingModule();
    expect(create(false, '{"theme":"light"}').theme()).toBe('light');

    TestBed.resetTestingModule();
    expect(create(false, '{"value":"light"}').theme()).toBe('light');
  });

  it('ignores an unparseable or unknown stored theme', () => {
    expect(create(false, '{"theme":"purple"}').theme()).toBe('dark');
  });

  it('toggles between themes and persists the choice', () => {
    const service = create(false);

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(storage.getItem(THEME_STORAGE_KEY)).toContain('light');

    service.toggle();
    expect(service.theme()).toBe('dark');
  });

  it('applies the theme to the document and the theme-color meta', () => {
    const service = create(false);

    service.setThemeSync('light');

    expect(doc().documentElement.dataset['theme']).toBe('light');
    expect(doc().querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#f1f0ec',
    );
  });

  it('ignores a no-op or invalid theme change', () => {
    const service = create(false);

    service.setTheme('dark');
    service.setTheme('nonsense' as never);

    expect(service.theme()).toBe('dark');
  });

  it('tracks the system preference until the user picks a theme', () => {
    const service = create(false);

    mediaHandler?.({ matches: true });
    expect(service.theme()).toBe('light');

    service.setTheme('dark');
    mediaHandler?.({ matches: true });
    expect(service.theme()).toBe('dark');
  });

  it('does not throw when the theme-color meta is absent', () => {
    for (const meta of [...doc().head.querySelectorAll('meta[name="theme-color"]')]) meta.remove();
    const service = create(false);

    expect(() => service.setThemeSync('light')).not.toThrow();
  });

  it('uses the documented media query', () => {
    create(false);
    expect(THEME_MEDIA_QUERY).toBe('(prefers-color-scheme: light)');
  });
});
