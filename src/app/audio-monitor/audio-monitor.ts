import { Component, inject, computed } from '@angular/core';
import { AudioCaptureService } from '../services/audio-capture-service';

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

@Component({
  selector: 'app-audio-monitor',
  templateUrl: './audio-monitor.html',
  styleUrl: './audio-monitor.scss',
})
export class AudioMonitor {
  private readonly audioCapture = inject(AudioCaptureService);

  protected readonly audioData = this.audioCapture.audioData;
  protected readonly isCapturing = this.audioCapture.isCapturing;
  protected readonly frequency = this.audioCapture.frequency;

  protected readonly noteInfo = computed(() => {
    const f = this.frequency();
    if (f === null || f <= 0) return null;

    const semitones = 12 * Math.log2(f / 440);
    const rounded = Math.round(semitones);
    const cents = Math.round((semitones - rounded) * 100);
    const idx = ((rounded % 12) + 12) % 12;
    const octave = 4 + Math.floor((rounded + 9) / 12);
    return { name: `${NOTE_NAMES[idx]}${octave}`, cents };
  });

  protected toggleCapture(): void {
    if (this.isCapturing()) {
      this.audioCapture.stopCapture();
    } else {
      this.audioCapture.startCapture();
    }
  }

  protected barHeight(value: number): number {
    return Math.abs(value) * 200;
  }
}
