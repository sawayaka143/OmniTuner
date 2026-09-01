import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY, catchError } from 'rxjs';

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

@Service()
export class AppUpdateService {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly updateAvailable = signal(false);

  private applying = false;

  private readonly onVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') void this.checkForUpdate();
  };

  constructor() {
    if (!this.updates) return;

    this.updates.versionUpdates.pipe(catchError(() => EMPTY)).subscribe((event) => {
      if (event.type === 'VERSION_READY') this.updateAvailable.set(true);
    });

    this.updates.unrecoverable.pipe(catchError(() => EMPTY)).subscribe(() => {
      this.updateAvailable.set(true);
    });

    const view = this.document.defaultView;
    if (!view) return;

    void this.checkForUpdate();
    view.addEventListener('visibilitychange', this.onVisibilityChange);
    const intervalId = view.setInterval(() => void this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      view.removeEventListener('visibilitychange', this.onVisibilityChange);
      view.clearInterval(intervalId);
    });
  }

  async checkForUpdate(): Promise<void> {
    try {
      await this.updates?.checkForUpdate();
    } catch {
      return;
    }
  }

  async applyUpdate(): Promise<void> {
    if (!this.updates || this.applying) return;
    this.applying = true;
    try {
      await this.updates.activateUpdate();
    } catch {
      return;
    } finally {
      this.document.defaultView?.location.reload();
    }
  }
}
