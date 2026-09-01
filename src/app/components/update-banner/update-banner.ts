import { Component, computed, inject, signal } from '@angular/core';

import { AppUpdateService } from '../../services/app-update.service';
import { IconButton } from '../../ui/icon-button/icon-button';

@Component({
  selector: 'app-update-banner',
  imports: [IconButton],
  template: `
    @if (visible()) {
      <div class="update-banner">
        <span class="message" role="status">New version available</span>
        <span class="actions">
          <button type="button" class="btn ghost reload" (click)="applyUpdate()">Reload</button>
          <app-icon-button
            icon="x"
            label="Dismiss update notification"
            size="sm"
            variant="ghost"
            (activate)="dismiss()"
          />
        </span>
      </div>
    }
  `,
  styleUrl: './update-banner.scss',
})
export class UpdateBanner {
  private readonly updates = inject(AppUpdateService);
  private readonly dismissed = signal(false);

  protected readonly visible = computed(() => this.updates.updateAvailable() && !this.dismissed());

  protected applyUpdate(): void {
    void this.updates.applyUpdate();
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}
