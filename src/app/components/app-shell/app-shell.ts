import {
  Component,
  DestroyRef,
  ElementRef,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { textColorOn } from '../../data/interval-colors';
import { TunerStartupMode } from '../../models/tuner-preferences.model';
import { HapticsService } from '../../services/haptics.service';
import { ScalePreferences } from '../../services/scale-preferences';
import { TunerPreferences } from '../../services/tuner-preferences';
import { ThemeService } from '../../services/theme.service';
import { applySurfaceOverrides, surfaceOverrides } from '../../utils/surface-theme';
import { Brand } from '../brand/brand';
import { SettingsPanel, type ThemeChangeEvent } from '../settings-panel/settings-panel';
import { ShortcutHelp } from '../shortcut-help/shortcut-help';
import { CommandPalette } from '../command-palette/command-palette';
import { IconButton } from '../../ui/icon-button/icon-button';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

interface NavIndicatorState {
  readonly x: number;
  readonly width: number;
  readonly visible: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/tuner', label: 'Tuner', icon: 'ti-wave-sine' },
  { path: '/chords', label: 'Chords', icon: 'ti-grid-dots' },
  { path: '/scales', label: 'Scales', icon: 'ti-music' },
  { path: '/metronome', label: 'Metronome', icon: 'ti-metronome' },
];

const PAGE_ROUTES: readonly string[] = NAV_ITEMS.map((item) => item.path);

@Component({
  selector: 'app-app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SettingsPanel,
    ShortcutHelp,
    CommandPalette,
    Brand,
    IconButton,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '[style.--scale-accent]': 'preferencesState().accent',
    '[style.--scale-accent-ink]': 'accentInk()',
    '[style.--in-tune-color]': 'inTuneColor()',
    '[style.--out-of-tune-color]': 'outOfTuneColor()',
    '(window:resize)': 'scheduleIndicatorMeasure()',
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class AppShell {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly preferences = inject(ScalePreferences);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly themeService = inject(ThemeService);
  private readonly haptics = inject(HapticsService);

  private readonly themeTrigger = viewChild('themeTrigger', { read: ElementRef });
  private readonly navLinks = viewChildren<ElementRef<HTMLAnchorElement>>('navLink');

  private readonly navigationEvents = this.router.events.subscribe((event) => {
    if (event instanceof NavigationEnd) {
      this.activePath.set(this.routePathOf(event.urlAfterRedirects));
      this.scheduleIndicatorMeasure();
    }
  });

  protected readonly settingsOpen = signal(false);
  protected readonly navItems = NAV_ITEMS;
  protected readonly shortcutOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));
  protected readonly tunerSettings = this.tunerPreferences.tunerSettings;
  protected readonly theme = this.themeService.theme;
  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'dark' ? 'sun' : 'moon',
  );
  protected readonly themeLabel = computed(() =>
    this.themeService.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );
  protected readonly indicator = signal<NavIndicatorState>({ x: 0, width: 0, visible: false });
  protected readonly indicatorReady = signal(false);
  protected readonly activePath = signal(this.routePathOf(this.router.url));
  protected readonly mobileTitle = computed(
    () => NAV_ITEMS.find((item) => item.path === this.activePath())?.label ?? 'OmniTuner',
  );

  private firstIndicatorMeasure = true;

  constructor() {
    this.destroyRef.onDestroy(() => this.navigationEvents.unsubscribe());
    this.scheduleIndicatorMeasure();
    this.scheduleIndicatorFontMeasure();
    effect(() => {
      const state = this.preferencesState();
      const theme = this.themeService.theme();
      applySurfaceOverrides(
        this.document.documentElement.style,
        surfaceOverrides(state.bgColor, state.cardColor, theme),
      );
    });
  }

  protected readonly inTuneColor = computed(() =>
    this.tunerSettings().inTune.enabled ? this.tunerSettings().inTune.color : null,
  );

  protected readonly outOfTuneColor = computed(() => this.tunerSettings().inTune.outOfTuneColor);

  protected setAccent(accent: string): void {
    this.preferences.setAccent(accent);
  }

  protected setRootNoteColor(color: string): void {
    this.preferences.setRootNoteColor(color);
  }

  protected setNoteColor(color: string): void {
    this.preferences.setNoteColor(color);
  }

  protected setBgColor(color: string | null): void {
    this.preferences.setBgColor(color);
  }

  protected setCardColor(color: string | null): void {
    this.preferences.setCardColor(color);
  }

  protected setTunerStartupMode(startupMode: TunerStartupMode): void {
    this.tunerPreferences.setStartupMode(startupMode);
  }

  protected setInTuneEnabled(enabled: boolean): void {
    this.tunerPreferences.setInTuneEnabled(enabled);
  }

  protected setInTuneSound(sound: boolean): void {
    this.tunerPreferences.setInTuneSound(sound);
  }

  protected setInTuneGlow(glow: boolean): void {
    this.tunerPreferences.setInTuneGlow(glow);
  }

  protected setInTuneColor(color: string): void {
    this.tunerPreferences.setInTuneColor(color);
  }

  protected setOutOfTuneColor(color: string): void {
    this.tunerPreferences.setOutOfTuneColor(color);
  }

  protected setInTuneTolerance(tolerance: number): void {
    this.tunerPreferences.setInTuneTolerance(tolerance);
  }

  protected setInTuneHoldMs(holdMs: number): void {
    this.tunerPreferences.setInTuneHoldMs(holdMs);
  }

  protected setReferencePitch(referencePitch: number): void {
    this.tunerPreferences.setReferencePitch(referencePitch);
  }

  protected toggleTheme(): void {
    this.applyThemeWithReveal(
      () => this.themeService.toggle(),
      () => this.themeService.toggleSync(),
    );
  }

  protected setThemeFromSettings(event: ThemeChangeEvent): void {
    if (event.theme === this.themeService.theme()) return;
    this.applyThemeWithReveal(
      () => this.themeService.setTheme(event.theme),
      () => this.themeService.setThemeSync(event.theme),
      event.origin,
    );
  }

  protected openShortcutsFromSettings(): void {
    this.settingsOpen.set(false);
    this.shortcutOpen.set(true);
  }

  private applyThemeWithReveal(
    fallback: () => void,
    sync: () => void,
    origin?: { readonly x: number; readonly y: number } | null,
  ): void {
    const doc = this.document;
    if (typeof doc.startViewTransition !== 'function' || this.prefersReducedMotion()) {
      fallback();
      return;
    }

    this.updateRevealOrigin(origin);
    doc.startViewTransition(sync);
  }

  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (this.isPaletteToggle(event)) {
      event.preventDefault();
      if (!this.settingsOpen()) this.paletteOpen.update((open) => !open);
      return;
    }
    if (this.settingsOpen()) return;
    if (this.isShortcutToggle(event)) {
      const target = event.target as HTMLElement | null;
      if (this.isEditableTarget(target)) return;
      event.preventDefault();
      this.shortcutOpen.update((open) => !open);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = event.target as HTMLElement | null;
    if (this.isEditableTarget(target)) return;
    const index = PAGE_ROUTES.indexOf(this.router.url.split('?')[0].split('#')[0]);
    if (index === -1) return;
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + offset + PAGE_ROUTES.length) % PAGE_ROUTES.length;
    event.preventDefault();
    void this.router.navigate([PAGE_ROUTES[next]]);
  }

  private isPaletteToggle(event: KeyboardEvent): boolean {
    return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k';
  }

  private isShortcutToggle(event: KeyboardEvent): boolean {
    return (
      (event.key === '?' || event.key === '/') && !event.ctrlKey && !event.metaKey && !event.altKey
    );
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return (
      !!el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable)
    );
  }

  private prefersReducedMotion(): boolean {
    try {
      return !!this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private updateRevealOrigin(origin?: { readonly x: number; readonly y: number } | null): void {
    const root = this.document.documentElement;
    const point = origin ?? this.themeTriggerOrigin();
    const x = point ? point.x : Math.round(root.clientWidth / 2);
    const y = point ? point.y : Math.round(root.clientHeight / 2);
    const radius = Math.hypot(
      Math.max(x, root.clientWidth - x),
      Math.max(y, root.clientHeight - y),
    );

    root.style.setProperty('--theme-reveal-x', `${x}px`);
    root.style.setProperty('--theme-reveal-y', `${y}px`);
    root.style.setProperty('--theme-reveal-radius', `${radius}px`);
  }

  private themeTriggerOrigin(): { readonly x: number; readonly y: number } | null {
    const trigger = this.themeTrigger()?.nativeElement as HTMLElement | undefined;
    const rect = trigger?.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  }

  protected scheduleIndicatorMeasure(): void {
    const view = this.document.defaultView;
    if (!view) return;
    view.requestAnimationFrame(() => this.measureIndicator());
  }

  private scheduleIndicatorFontMeasure(): void {
    const view = this.document.defaultView;
    if (!view) return;
    void view.document.fonts?.ready.then(() => this.measureIndicator());
  }

  private measureIndicator(): void {
    this.measureIndicatorFor(this.navLinks(), this.indicator);
  }

  private routePathOf(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    if (path === '/' || path === '') return PAGE_ROUTES[0];
    return path;
  }

  protected onNavActivate(): void {
    this.haptics.light();
  }

  private measureIndicatorFor(
    links: readonly ElementRef<HTMLAnchorElement>[],
    indicator: WritableSignal<NavIndicatorState>,
  ): void {
    const index = links.findIndex((link) => link.nativeElement.classList.contains('active'));
    const link = index === -1 ? null : links[index].nativeElement;

    if (!link || link.offsetWidth === 0) {
      indicator.set({ x: 0, width: 0, visible: false });
      return;
    }

    indicator.set({ x: link.offsetLeft, width: link.offsetWidth, visible: true });

    if (this.firstIndicatorMeasure) {
      this.firstIndicatorMeasure = false;
      this.document.defaultView?.requestAnimationFrame(() => this.indicatorReady.set(true));
    }
  }
}
