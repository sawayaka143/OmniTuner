import { inject, InjectionToken, Service } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

interface HapticsPlugin {
  impact(options: { style: ImpactStyle }): Promise<void>;
  notification(options: { type: NotificationType }): Promise<void>;
}

export const HAPTICS_PLUGIN = new InjectionToken<HapticsPlugin | null>('Native haptics plugin', {
  factory: () => (Capacitor.isNativePlatform() ? Haptics : null),
});

@Service()
export class HapticsService {
  private readonly plugin = inject(HAPTICS_PLUGIN);

  light(): void {
    void this.plugin?.impact({ style: ImpactStyle.Light }).catch(() => {});
  }

  medium(): void {
    void this.plugin?.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }

  success(): void {
    void this.plugin?.notification({ type: NotificationType.Success }).catch(() => {});
  }
}
