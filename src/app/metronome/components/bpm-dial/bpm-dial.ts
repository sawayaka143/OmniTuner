import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { BPM_MAX, BPM_MIN } from '../../models/metronome.model';

const SWEEP_DEG = 270;
const START_DEG = -135;

function clampBpm(value: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

function bpmToAngle(bpm: number): number {
  const t = (clampBpm(bpm) - BPM_MIN) / (BPM_MAX - BPM_MIN);
  return START_DEG + t * SWEEP_DEG;
}

function angleToBpm(angle: number): number {
  const t = (angle - START_DEG) / SWEEP_DEG;
  return clampBpm(BPM_MIN + t * (BPM_MAX - BPM_MIN));
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

@Component({
  selector: 'app-bpm-dial',
  templateUrl: './bpm-dial.html',
  styleUrl: './bpm-dial.scss',
})
export class BpmDial {
  readonly bpm = input.required<number>();
  readonly bpmChange = output<number>();

  private readonly dialRef = viewChild<ElementRef<HTMLElement>>('dial');
  private dragging = signal(false);

  protected angle = computed(() => bpmToAngle(this.bpm()));
  protected trackPath = describeArc(60, 60, 48, START_DEG, START_DEG + SWEEP_DEG);
  protected valuePath = computed(() => describeArc(60, 60, 48, START_DEG, this.angle()));
  protected handlePos = computed(() => {
    const a = (this.angle() * Math.PI) / 180;
    return { x: 60 + 48 * Math.cos(a), y: 60 + 48 * Math.sin(a) };
  });

  protected onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.updateFromEvent(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.updateFromEvent(event);
  }

  protected onPointerUp(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    this.dragging.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.bpmChange.emit(clampBpm(this.bpm() + step));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.bpmChange.emit(clampBpm(this.bpm() - step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.bpmChange.emit(BPM_MIN);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.bpmChange.emit(BPM_MAX);
    }
  }

  private updateFromEvent(event: PointerEvent): void {
    const el = this.dialRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
    while (deg < START_DEG) deg += 360;
    while (deg > START_DEG + 360) deg -= 360;
    if (deg > START_DEG + SWEEP_DEG) {
      const distToStart = Math.abs(deg - (START_DEG + SWEEP_DEG));
      const distToEnd = Math.abs(deg - 360 - START_DEG);
      deg = distToStart < distToEnd ? START_DEG + SWEEP_DEG : START_DEG;
    }
    this.bpmChange.emit(angleToBpm(deg));
  }
}
