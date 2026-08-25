import { Component, computed, inject, signal } from '@angular/core';
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
  private readonly preferences = inject(ScalePreferences);
  private readonly tunerPreferences = inject(TunerPreferences);
  private readonly themeService = inject(ThemeService);

  protected readonly settingsOpen = signal(false);
  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));
  protected readonly tunerSettings = this.tunerPreferences.tunerSettings;
  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'dark' ? 'light_mode' : 'dark_mode',
  );
  protected readonly themeLabel = computed(() =>
    this.themeService.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );

  /** In-tune color as a theme var; unset while the master switch is OFF. */
  protected readonly inTuneColor = computed(() =>
    this.tunerSettings().inTune.enabled ? this.tunerSettings().inTune.color : null,
  );

  /** Off-pitch color as a theme var; independent of the master switch. */
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
    this.themeService.toggle();
  }
}
