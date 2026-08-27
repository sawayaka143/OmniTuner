import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { textColorOn } from '../../data/interval-colors';
import { TunerStartupMode } from '../../models/tuner-preferences.model';
import { ScalePreferences } from '../../services/scale-preferences';
import { TunerPreferences } from '../../services/tuner-preferences';
import { Brand } from '../brand/brand';
import { SettingsPanel } from '../settings-panel/settings-panel';
import { ThemeService } from '../../services/theme.service';
import { IconButton } from '../../ui/icon-button/icon-button';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SettingsPanel, Brand, IconButton],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '[style.--scale-accent]': 'preferencesState().accent',
    '[style.--scale-accent-ink]': 'accentInk()',
    '[style.--in-tune-color]': 'inTuneColor()',
    '[style.--out-of-tune-color]': 'outOfTuneColor()',
  },
})
export class AppShell {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(ScalePreferences);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly themeService = inject(ThemeService);

  private readonly themeTrigger = viewChild('themeTrigger', { read: ElementRef });

  protected readonly settingsOpen = signal(false);
  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));
  protected readonly tunerSettings = this.tunerPreferences.tunerSettings;
  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'dark' ? 'sun' : 'moon',
  );
  protected readonly themeLabel = computed(() =>
    this.themeService.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );

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

  protected setWorkbenchScale(scale: number): void {
    this.preferences.setWorkbenchScale(scale);
  }

  protected setChordRandomProgression(chordRandomProgression: boolean): void {
    this.preferences.setChordRandomProgression(chordRandomProgression);
  }

  protected resetWorkbenchScale(): void {
    this.preferences.resetWorkbenchScale();
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
    const doc = this.document;
    if (typeof doc.startViewTransition !== 'function' || this.prefersReducedMotion()) {
      this.themeService.toggle();
      return;
    }

    this.updateRevealOrigin();
    doc.startViewTransition(() => this.themeService.toggleSync());
  }

  private prefersReducedMotion(): boolean {
    try {
      return !!this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private updateRevealOrigin(): void {
    const trigger = this.themeTrigger()?.nativeElement as HTMLElement | undefined;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const root = this.document.documentElement;
    const radius = Math.hypot(
      Math.max(x, root.clientWidth - x),
      Math.max(y, root.clientHeight - y),
    );

    root.style.setProperty('--theme-reveal-x', `${x}px`);
    root.style.setProperty('--theme-reveal-y', `${y}px`);
    root.style.setProperty('--theme-reveal-radius', `${radius}px`);
  }
}
