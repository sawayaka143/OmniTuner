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

  it('says it is waiting for the microphone while the permission prompt is open', () => {
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.capture-btn') as HTMLButtonElement;

    expect(fixture.componentInstance.statusMessage()).toBe('WAITING FOR THE MICROPHONE');
    expect(button.textContent?.trim()).toBe('Starting…');
    expect(button.disabled).toBe(true);
  });

  it('tells an idle user how to start tuning', () => {
    TestBed.inject(TunerPreferences).setAutoStart(false);
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.capture-btn') as HTMLButtonElement;

    expect(fixture.componentInstance.statusMessage()).toBe('PRESS START TO TUNE');
    expect(button.textContent?.trim()).toBe('Start');
    expect(button.disabled).toBe(false);
  });

  it('shows a blocked microphone as an error and offers to try again', async () => {
    TestBed.inject(TunerPreferences).setAutoStart(false);
    getUserMedia.mockRejectedValue(
      Object.assign(new Error('blocked'), { name: 'NotAllowedError' }),
    );
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    await TestBed.inject(AudioCaptureService).startCapture();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.pitch-status') as HTMLElement;
    const button = fixture.nativeElement.querySelector('.capture-btn') as HTMLButtonElement;
    expect(status.textContent).toContain('Microphone access was blocked');
    expect(status.classList.contains('error')).toBe(true);
    expect(button.textContent?.trim()).toBe('Try again');
    expect(button.disabled).toBe(false);
  });

  it('disables the capture button when the browser has no microphone API', async () => {
    TestBed.inject(TunerPreferences).setAutoStart(false);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    await TestBed.inject(AudioCaptureService).startCapture();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.capture-btn') as HTMLButtonElement;
    expect(fixture.componentInstance.statusMessage()).toContain("can't access the microphone");
    expect(button.textContent?.trim()).toBe('Start');
    expect(button.disabled).toBe(true);
  });

  it('keeps naming the target string while a reading is held, and dims the readout', () => {
    const fixture = TestBed.createComponent(AudioMonitor);
    const service = TestBed.inject(AudioCaptureService);
    service.isCapturing.set(true);
    service.frequency.set(110);
    service.trackingState.set('holding');
    fixture.detectChanges();

    expect(fixture.componentInstance.statusMessage()).toBe('TUNING A2');
    expect(fixture.componentInstance.isLocked()).toBe(false);
    expect(fixture.nativeElement.querySelector('.meter-needle').classList).toContain('stale');
    expect(fixture.nativeElement.querySelector('.pitch-note').classList).toContain('stale');
  });

  it('confirms a locked reading as in tune but never a held one', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(AudioMonitor);
      const service = TestBed.inject(AudioCaptureService);
      const holdMs = TestBed.inject(TunerPreferences).tunerSettings().inTune.holdMs;
      service.isCapturing.set(true);
      service.frequency.set(110);
      service.trackingState.set('holding');
      fixture.detectChanges();
      vi.advanceTimersByTime(holdMs * 3);
      fixture.detectChanges();

      expect(fixture.componentInstance.inRange()).toBe(true);
      expect(fixture.componentInstance.isTuned()).toBe(false);

      service.trackingState.set('locked');
      fixture.detectChanges();
      vi.advanceTimersByTime(holdMs + 50);
      fixture.detectChanges();

      expect(fixture.componentInstance.isTuned()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the tuning once in the header and leaves the strings to the string buttons', () => {
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.workbench-header') as HTMLElement;

    expect(header.querySelector('h2')?.textContent?.trim()).toBe(
      fixture.componentInstance.currentTuning().label,
    );
    expect(header.querySelector('p')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-string-list button')).toHaveLength(
      fixture.componentInstance.currentStrings().length,
    );
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

  it('hides the diagnostics panel by default', () => {
    const fixture = TestBed.createComponent(AudioMonitor);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-tuner-diagnostics')).toBeNull();
  });

  it('shows the diagnostics panel when the URL has a diagnostics flag', () => {
    const original = window.location.href;
    window.history.replaceState(null, '', '/tuner?diagnostics');
    try {
      const fixture = TestBed.createComponent(AudioMonitor);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-tuner-diagnostics')).not.toBeNull();
    } finally {
      window.history.replaceState(null, '', original);
    }
  });

  it('tells the capture service the lowest string of the current tuning', () => {
    const setLowestNote = vi.spyOn(TestBed.inject(AudioCaptureService), 'setLowestNote');
    const component = create();
    const lowest = Math.min(...component.currentStrings().map((string) => string.freq));

    expect(setLowestNote).toHaveBeenLastCalledWith(lowest);
  });
});
