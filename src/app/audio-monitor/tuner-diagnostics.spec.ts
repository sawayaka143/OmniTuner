import { TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { AudioCaptureService } from '../services/audio-capture-service';
import { CaptureDiagnostics } from '../services/capture-diagnostics';
import { SAMPLE_FRAME_COUNT, TunerDiagnostics } from './tuner-diagnostics';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(): void {}
  terminate(): void {}
}

const sample: CaptureDiagnostics = {
  mic: {
    label: 'iPhone Microphone',
    contextSampleRate: 48000,
    trackSampleRate: 48000,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: null,
    autoGainControl: true,
    supportedConstraints: ['echoCancellation'],
    userAgent: 'TestAgent',
  },
  range: { minFrequency: 49.4, highpassHz: 41.2 },
  last: {
    inputLevel: 0.01,
    clarity: 0.42,
    candidateFrequency: 82.4,
    accepted: false,
    analysisMs: 0.8,
    receivedAt: 0,
    gate: 0.001,
    noiseFloor: 0.0005,
    outcome: 'unclear',
  },
  frames: 4,
  outcomes: { detected: 1, unclear: 2, silent: 1 },
  peakLevel: 0.05,
  averageAnalysisMs: 0.8,
  slowestAnalysisMs: 1.6,
  analysesPerSecond: 21.5,
};

describe('TunerDiagnostics', () => {
  let capture: AudioCaptureService;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    TestBed.configureTestingModule({ imports: [TunerDiagnostics] });
    capture = TestBed.inject(AudioCaptureService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  const render = async (): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(TunerDiagnostics);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('prompts to start the tuner before any data exists', async () => {
    const element = await render();
    expect(element.textContent).toContain('Start the tuner to collect diagnostics.');
  });

  it('shows live level, clarity, frame mix, timing and mic processing', async () => {
    capture.diagnostics.set(sample);
    const text = (await render()).textContent ?? '';

    expect(text).toContain('-40.0 dBFS');
    expect(text).toContain('gate -60 dB');
    expect(text).toContain('-66.0 dBFS');
    expect(text).toContain('Audible, no clear pitch');
    expect(text).toContain('0.42');
    expect(text).toContain('needs 0.58');
    expect(text).toContain('82.4 Hz');
    expect(text).toContain('25% detected');
    expect(text).toContain('50% unclear');
    expect(text).toContain('0.8 ms avg');
    expect(text).toContain('21.5/s');
    expect(text).toContain('iPhone Microphone · 1 ch · 48000 Hz');
    expect(text).toContain('echo off · noise unknown · gain on');
    expect(text).toContain('49–1500 Hz · low cut 41 Hz');
  });

  it('copies a plain-text report to the clipboard', async () => {
    capture.diagnostics.set(sample);
    const element = await render();
    const copy = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Copy report'),
    )!;

    copy.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Mic: iPhone Microphone'));
  });

  it('resets the running stats through the capture service', async () => {
    capture.diagnostics.set(sample);
    const reset = vi.spyOn(capture, 'resetDiagnostics');
    const element = await render();
    const button = Array.from(element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Reset'),
    )!;

    button.click();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('records a sample and downloads it as a WAV file', async () => {
    capture.diagnostics.set(sample);
    const frames = [new Float32Array(4).fill(0.1), new Float32Array(4).fill(-0.1)];
    const record = vi.spyOn(capture, 'recordSample').mockResolvedValue({
      frames,
      gates: [0.001, 0.001],
      sampleRate: 48000,
      frameSize: 4,
      hopMs: 45,
      range: { minFrequency: 49.4, highpassHz: 41.2 },
    });
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:sample');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const fixture = TestBed.createComponent(TunerDiagnostics);
    await fixture.whenStable();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.includes('Record 5 s'))!;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();

    expect(record).toHaveBeenCalledWith(SAMPLE_FRAME_COUNT);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(44 + 8 * 4);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^omnituner-sample-.*\.wav$/);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sample saved.');
    click.mockRestore();
  });

  it('shows recording progress and reports a failed recording', async () => {
    capture.diagnostics.set(sample);
    vi.spyOn(capture, 'recordSample').mockRejectedValue(new Error('Recording stopped early.'));
    const fixture = TestBed.createComponent(TunerDiagnostics);
    capture.recordingProgress.set(0.42);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = Array.from(element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Recording 42%'),
    )!;
    expect(button.disabled).toBe(true);

    capture.recordingProgress.set(null);
    await fixture.whenStable();
    Array.from(element.querySelectorAll('button'))
      .find((candidate) => candidate.textContent?.includes('Record 5 s'))!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();

    expect(element.textContent).toContain('Recording stopped early.');
  });

  it('has no accessibility violations', async () => {
    capture.diagnostics.set(sample);
    const results = await axe(await render());
    expect(results).toHaveNoViolations();
  });
});
