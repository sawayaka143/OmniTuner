import { Component, computed, inject } from '@angular/core';

import { Onboarding } from '../services/onboarding';

export const TUNER_INTRO_STEP = 'tuner-intro';

@Component({
  selector: 'app-tuner-intro',
  templateUrl: './tuner-intro.html',
  styleUrl: './tuner-intro.scss',
})
export class TunerIntro {
  private readonly onboarding = inject(Onboarding);

  protected readonly visible = computed(() => !this.onboarding.dismissed().has(TUNER_INTRO_STEP));

  protected dismiss(): void {
    this.onboarding.dismiss(TUNER_INTRO_STEP);
  }
}
