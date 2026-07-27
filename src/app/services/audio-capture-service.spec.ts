import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture-service';

class MockWorker {
  onmessage: ((event: MessageEvent<{ frequency: number | null; confidence: number }>) => void) | null = null;

  postMessage(): void {}
  terminate(): void {}
}

describe('AudioCaptureService', () => {
  let service: AudioCaptureService;

  beforeEach(() => {
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioCaptureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});