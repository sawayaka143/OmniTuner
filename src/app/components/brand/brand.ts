import { Component, computed, inject } from '@angular/core';
import { AudioCaptureService } from '../../services/audio-capture-service';
import { ScalePlayback } from '../../services/scale-playback';

@Component({
  selector: 'app-brand',
  imports: [],
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
  host: {
    '[class.playing]': 'playing()',
  },
})
export class Brand {
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly scalePlayback = inject(ScalePlayback);

  protected readonly playing = computed(
    () => this.audioCapture.isCapturing() || this.scalePlayback.isPlaying(),
  );
}
