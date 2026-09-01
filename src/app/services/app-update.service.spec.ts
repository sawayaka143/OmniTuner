import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppUpdateService, UPDATE_CHECK_INTERVAL_MS } from './app-update.service';

class FakeWindow {
  readonly document = { visibilityState: 'visible' };
  readonly location = { reload: vi.fn() };

  readonly listeners = new Map<string, EventListener>();
  readonly intervalHandle = 42;

  readonly addEventListener = vi.fn((type: string, listener: EventListener) => {
    this.listeners.set(type, listener);
  });
  readonly removeEventListener = vi.fn((type: string) => {
    this.listeners.delete(type);
  });
  readonly setInterval = vi.fn(() => this.intervalHandle);
  readonly clearInterval = vi.fn();

  dispatchVisibilityChange(state: 'visible' | 'hidden'): void {
    this.document.visibilityState = state;
    this.listeners.get('visibilitychange')?.(new Event('visibilitychange'));
  }
}

interface FakeSwUpdate {
  versionUpdates: Subject<VersionEvent>;
  unrecoverable: Subject<UnrecoverableStateEvent>;
  checkForUpdate: ReturnType<typeof vi.fn>;
  activateUpdate: ReturnType<typeof vi.fn>;
}

const fakeEvent = (type: VersionEvent['type']): VersionEvent => ({ type }) as VersionEvent;

describe('AppUpdateService', () => {
  let sw: FakeSwUpdate;
  let fakeWindow: FakeWindow;
  let fakeDocument: {
    defaultView: FakeWindow;
    readonly visibilityState: string;
  };

  function createService(withSwUpdate: boolean): AppUpdateService {
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: fakeDocument },
        ...(withSwUpdate ? [{ provide: SwUpdate, useValue: sw }] : []),
      ],
    });
    return TestBed.inject(AppUpdateService);
  }

  beforeEach(() => {
    sw = {
      versionUpdates: new Subject<VersionEvent>(),
      unrecoverable: new Subject<UnrecoverableStateEvent>(),
      checkForUpdate: vi.fn().mockResolvedValue(undefined),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    fakeWindow = new FakeWindow();
    fakeDocument = {
      defaultView: fakeWindow,
      get visibilityState(): string {
        return fakeWindow.document.visibilityState;
      },
    };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(createService(true)).toBeTruthy();
  });

  it('does nothing when the service worker is disabled (dev or native)', () => {
    const service = createService(false);

    expect(service.updateAvailable()).toBe(false);
    expect(fakeWindow.addEventListener).not.toHaveBeenCalled();
    expect(fakeWindow.setInterval).not.toHaveBeenCalled();
  });

  it('flags an update when a new version becomes ready', () => {
    const service = createService(true);
    expect(service.updateAvailable()).toBe(false);

    sw.versionUpdates.next(fakeEvent('VERSION_READY'));
    expect(service.updateAvailable()).toBe(true);
  });

  it('ignores intermediate version events', () => {
    const service = createService(true);

    sw.versionUpdates.next(fakeEvent('VERSION_DETECTED'));
    sw.versionUpdates.next(fakeEvent('NO_NEW_VERSION_DETECTED'));
    expect(service.updateAvailable()).toBe(false);
  });

  it('flags an update when the worker enters an unrecoverable state', () => {
    const service = createService(true);

    sw.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'test failure' });
    expect(service.updateAvailable()).toBe(true);
  });

  it('checks for updates on start and on an hourly interval', () => {
    createService(true);

    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(fakeWindow.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      UPDATE_CHECK_INTERVAL_MS,
    );
  });

  it('checks for updates when the tab becomes visible again', () => {
    createService(true);
    sw.checkForUpdate.mockClear();

    fakeWindow.dispatchVisibilityChange('hidden');
    expect(sw.checkForUpdate).not.toHaveBeenCalled();

    fakeWindow.dispatchVisibilityChange('visible');
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('removes the visibility listener and interval on destroy', () => {
    createService(true);

    TestBed.resetTestingModule();

    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(fakeWindow.clearInterval).toHaveBeenCalledWith(42);
  });

  it('activates the pending version and reloads when applying an update', async () => {
    const service = createService(true);

    await service.applyUpdate();

    expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    expect(fakeWindow.location.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads even when activation fails', async () => {
    const service = createService(true);
    sw.activateUpdate.mockRejectedValue(new Error('offline'));

    await service.applyUpdate();

    expect(fakeWindow.location.reload).toHaveBeenCalledTimes(1);
  });

  it('only applies one update at a time', async () => {
    const service = createService(true);
    sw.activateUpdate.mockReturnValue(new Promise(() => {}));

    void service.applyUpdate();
    await service.applyUpdate();
    expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    expect(fakeWindow.location.reload).not.toHaveBeenCalled();
  });

  it('does not reload when there is no service worker to update', async () => {
    const service = createService(false);

    await service.applyUpdate();

    expect(fakeWindow.location.reload).not.toHaveBeenCalled();
  });

  it('swallows failures to check for updates (offline or unsupported)', async () => {
    const service = createService(true);
    sw.checkForUpdate.mockRejectedValue(new Error('no registration'));

    await expect(service.checkForUpdate()).resolves.toBeUndefined();
  });
});
