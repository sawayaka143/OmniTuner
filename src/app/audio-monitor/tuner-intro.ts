import { Component, computed, effect, inject } from '@angular/core';

import { AudioCaptureService } from '../services/audio-capture-service';
import { Onboarding } from '../services/onboarding';

export const TUNER_INTRO_STEP = 'tuner-intro';

@Component({
  selector: 'app-tuner-intro',
  templateUrl: './tuner-intro.html',
  styleUrl: './tuner-intro.scss',
})
export class TunerIntro {
  private readonly onboarding = inject(Onboarding);
  private readonly audioCapture = inject(AudioCaptureService);

  protected readonly visible = computed(() => !this.onboarding.dismissed().has(TUNER_INTRO_STEP));

  constructor() {
    effect(() => {
      if (this.audioCapture.isCapturing()) this.dismiss();
    });
  }

  protected dismiss(): void {
    this.onboarding.dismiss(TUNER_INTRO_STEP);
  }
}
