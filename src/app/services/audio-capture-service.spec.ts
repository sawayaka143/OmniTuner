import { TestBed } from '@angular/core/testing';

import { AudioCaptureService } from './audio-capture-service';

describe('AudioCaptureService', () => {
  let service: AudioCaptureService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioCaptureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
