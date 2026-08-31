import { TestBed } from '@angular/core/testing';
import { ImpactStyle, NotificationType } from '@capacitor/haptics';

import { HAPTICS_PLUGIN, HapticsService } from './haptics.service';

describe('HapticsService', () => {
  const createWithPlugin = (plugin: unknown): HapticsService => {
    TestBed.configureTestingModule({ providers: [{ provide: HAPTICS_PLUGIN, useValue: plugin }] });
    return TestBed.inject(HapticsService);
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('resolves to no plugin when not running on a native platform', () => {
    TestBed.configureTestingModule({});
    const plugin = TestBed.inject(HAPTICS_PLUGIN);
    expect(plugin).toBeNull();
  });

  it('is inert when no plugin is available', () => {
    const service = createWithPlugin(null);
    expect(() => service.light()).not.toThrow();
    expect(() => service.medium()).not.toThrow();
    expect(() => service.success()).not.toThrow();
  });

  it('forwards light feedback as a light impact', () => {
    const impact = vi.fn().mockResolvedValue(undefined);
    const notification = vi.fn().mockResolvedValue(undefined);
    const service = createWithPlugin({ impact, notification });

    service.light();

    expect(impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
    expect(notification).not.toHaveBeenCalled();
  });

  it('forwards medium feedback as a medium impact', () => {
    const impact = vi.fn().mockResolvedValue(undefined);
    const service = createWithPlugin({ impact, notification: vi.fn() });

    service.medium();

    expect(impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium });
  });

  it('forwards success feedback as a success notification', () => {
    const notification = vi.fn().mockResolvedValue(undefined);
    const service = createWithPlugin({ impact: vi.fn(), notification });

    service.success();

    expect(notification).toHaveBeenCalledWith({ type: NotificationType.Success });
  });

  it('swallows plugin rejections instead of surfacing unhandled errors', async () => {
    const impact = vi.fn().mockRejectedValue(new Error('no haptics hardware'));
    const service = createWithPlugin({ impact, notification: vi.fn() });

    service.light();
    await Promise.resolve();

    expect(impact).toHaveBeenCalledOnce();
  });
});
