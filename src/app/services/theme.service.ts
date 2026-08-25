import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, InjectionToken, Service, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'omnituner.theme.v1';
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: light)';
export const THEME_STORAGE = new InjectionToken<Storage | null>('Theme storage', {
  factory: () => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  },
});

const THEME_COLOR: Record<Theme, string> = {
  light: '#f1f0ec',
  dark: '#121211',
};

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const parseStoredTheme = (raw: string | null): Theme | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isTheme(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if (isTheme(record['theme'])) return record['theme'];
      if (typeof record['value'] === 'string' && isTheme(record['value'])) return record['value'];
    }
  } catch {
    if (isTheme(raw)) return raw;
  }
  return null;
};

@Service()
export class ThemeService {
  private readonly storage = inject(THEME_STORAGE);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeSignal = signal<Theme>(this.load());

  readonly theme = this.themeSignal.asReadonly();

  constructor() {
    this.apply(this.themeSignal());

    effect(() => {
      this.apply(this.themeSignal());
    });

    this.watchSystemPreference();
  }

  setTheme(theme: Theme): void {
    if (!isTheme(theme) || this.themeSignal() === theme) return;
    this.themeSignal.set(theme);
    this.persist(theme);
  }

  toggle(): void {
    this.setTheme(this.nextTheme());
  }

  /**
   * Toggle and apply the DOM change synchronously. The regular toggle()
   * defers to the effect queue, which flushes too late for the View
   * Transitions API — the new theme must be on the document before the
   * transition callback resolves or the new-state snapshot captures the old
   * look. Applying twice (here + the effect) is harmless; apply() is
   * idempotent.
   */
  toggleSync(): void {
    const next = this.nextTheme();
    this.themeSignal.set(next);
    this.persist(next);
    this.apply(next);
  }

  private nextTheme(): Theme {
    return this.themeSignal() === 'dark' ? 'light' : 'dark';
  }

  private load(): Theme {
    const stored = parseStoredTheme(this.readStorage());
    if (stored) return stored;
    return this.systemPrefersLight() ? 'light' : 'dark';
  }

  private readStorage(): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persist(theme: Theme): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // Storage can be unavailable or full; in-memory signal remains usable.
    }
  }

  private systemPrefersLight(): boolean {
    try {
      return !!this.document.defaultView?.matchMedia(THEME_MEDIA_QUERY).matches;
    } catch {
      return false;
    }
  }

  private apply(theme: Theme): void {
    const root = this.document.documentElement;
    if (!root) return;
    root.dataset['theme'] = theme;
    try {
      root.style.setProperty('color-scheme', theme);
    } catch {
      // JSDOM or older engines may not support color-scheme style.
    }
    const meta = this.document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
  }

  private watchSystemPreference(): void {
    const view = this.document.defaultView;
    if (!view?.matchMedia) return;
    let media: MediaQueryList | null = null;
    try {
      media = view.matchMedia(THEME_MEDIA_QUERY);
    } catch {
      return;
    }
    if (!media) return;

    const handler = (event: MediaQueryListEvent): void => {
      if (this.readStorage() !== null) return;
      this.themeSignal.set(event.matches ? 'light' : 'dark');
    };

    try {
      media.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => {
        try {
          media?.removeEventListener('change', handler);
        } catch {
          // Ignore teardown errors.
        }
      });
    } catch {
      // Safari < 14 uses addListener; silently ignore if unavailable.
      try {
        (
          media as unknown as {
            addListener: (cb: (e: MediaQueryListEvent) => void) => void;
            removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
          }
        ).addListener(handler);
        this.destroyRef.onDestroy(() => {
          try {
            (
              media as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }
            ).removeListener(handler);
          } catch {
            // Ignore teardown errors.
          }
        });
      } catch {
        // No system-preference watching available.
      }
    }
  }
}
