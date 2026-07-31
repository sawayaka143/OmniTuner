import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { textColorOn } from '../../data/interval-colors';
import { ScalePreferences } from '../../services/scale-preferences';
import { Brand } from '../brand/brand';
import { SettingsPanel } from '../settings-panel/settings-panel';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SettingsPanel, Brand],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  host: {
    '[style.--scale-accent]': 'preferencesState().accent',
    '[style.--scale-accent-ink]': 'accentInk()',
  },
})
export class AppShell {
  private readonly preferences = inject(ScalePreferences);

  protected readonly settingsOpen = signal(false);
  protected readonly preferencesState = this.preferences.state;
  protected readonly accentInk = computed(() => textColorOn(this.preferencesState().accent));

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

  protected resetWorkbenchScale(): void {
    this.preferences.resetWorkbenchScale();
  }
}
