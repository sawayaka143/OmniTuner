import { TestBed } from '@angular/core/testing';
import { ImpactStyle, NotificationType } from '@capacitor/haptics';

import { AudioCaptureService } from '../services/audio-capture-service';
import { HAPTICS_PLUGIN } from '../services/haptics.service';
import { SCALE_AUDIO_CONTEXT_FACTORY } from '../services/scale-playback';
import { TunerPreferences } from '../services/tuner-preferences';
import { AudioMonitor } from './audio-monitor';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(): void {}
  terminate(): void {}
}

describe('AudioMonitor', () => {
  let impact: ReturnType<typeof vi.fn>;
  let notification: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    impact = vi.fn().mockResolvedValue(undefined);
    notification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Worker', MockWorker);
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    getUserMedia = vi.fn().mockReturnValue(new Promise(() => {}));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    TestBed.configureTestingModule({
      imports: [AudioMonitor],
      providers: [
        { provide: HAPTICS_PLUGIN, useValue: { impact, notification } },
        { provide: SCALE_AUDIO_CONTEXT_FACTORY, useValue: () => null },
      ],
    });
    TestBed.inject(TunerPreferences).setAutoStart(true);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
  });

  const create = (): AudioMonitor => {
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('should be created', () => {
    expect(create()).toBeTruthy();
  });

  it('gives light haptic feedback when capture is toggled', () => {
    const component = create();

    (component as unknown as { toggleCapture(): void }).toggleCapture();

    expect(impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  it('gives success haptic feedback when a note is confirmed in tune', () => {
    const component = create();

    (component as unknown as { confirmLock(): void }).confirmLock();

    expect(notification).toHaveBeenCalledWith({ type: NotificationType.Success });
  });

  it('reports idle in the status message until capture starts', () => {
    const component = create();
    expect(component.statusMessage()).toBe('IDLE');
  });

  it('surfaces capture errors through the status message', () => {
    const component = create();
    TestBed.inject(AudioCaptureService).captureError.set('Microphone access is unavailable.');
    expect(component.statusMessage()).toBe('Microphone access is unavailable.');
  });

  it('auto-starts capture when the tuner page mounts', () => {
    create();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('does not auto-start when the preference is disabled', () => {
    TestBed.inject(TunerPreferences).setAutoStart(false);
    getUserMedia.mockClear();
    create();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('keeps the microphone running when the tuner page is destroyed', () => {
    const fixture = TestBed.createComponent(AudioMonitor);
    const service = TestBed.inject(AudioCaptureService);
    service.isCapturing.set(true);
    fixture.detectChanges();
    fixture.destroy();
    expect(service.isCapturing()).toBe(true);
  });
});
