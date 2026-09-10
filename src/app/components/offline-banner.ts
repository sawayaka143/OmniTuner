import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

@Component({
  selector: 'app-offline-banner',
  templateUrl: './offline-banner.html',
  styleUrl: './offline-banner.scss',
  host: {
    '(window:offline)': 'onOffline()',
    '(window:online)': 'onOnline()',
  },
})
export class OfflineBanner {
  private readonly document = inject(DOCUMENT);

  protected readonly offline = signal(this.isOffline());

  protected onOffline(): void {
    this.offline.set(true);
  }

  protected onOnline(): void {
    this.offline.set(false);
  }

  private isOffline(): boolean {
    try {
      return this.document.defaultView?.navigator?.onLine === false;
    } catch {
      return false;
    }
  }
}
