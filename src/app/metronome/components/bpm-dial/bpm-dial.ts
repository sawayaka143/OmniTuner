import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { BPM_MAX, BPM_MIN } from '../../models/metronome.model';

/** Tick marks per full rotation — one rotation = 55 BPM, one tick = 1 BPM. */
const TICKS_PER_ROTATION = 55;
const DEG_PER_TICK = 360 / TICKS_PER_ROTATION;
/** Pointer sits at 12 o'clock in SVG coordinates (0° = 3 o'clock, positive = clockwise). */
const POINTER_DEG = 270;
const CX = 150;
const CY = 150;
const TICK_INNER = 116;
const TICK_OUTER = 124;

function clampBpm(value: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

/** Rotating face position for a BPM value; positive rotation = clockwise. */
function rotationFor(bpm: number): number {
  return (bpm - 1) * DEG_PER_TICK;
}

/** BPM for a face rotation, clamped to the dial range. */
function bpmFor(rotation: number): number {
  return clampBpm(rotation / DEG_PER_TICK + 1);
}

interface TickMark {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** 55 tick marks laid out clockwise starting at the pointer (12 o'clock). */
const TICK_MARKS: readonly TickMark[] = Array.from({ length: TICKS_PER_ROTATION }, (_, i) => {
  const a = ((POINTER_DEG + i * DEG_PER_TICK) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x1: CX + TICK_INNER * cos,
    y1: CY + TICK_INNER * sin,
    x2: CX + TICK_OUTER * cos,
    y2: CY + TICK_OUTER * sin,
  };
});

@Component({
  selector: 'app-bpm-dial',
  templateUrl: './bpm-dial.html',
  styleUrl: './bpm-dial.scss',
})
export class BpmDial {
  readonly bpm = input.required<number>();
  readonly bpmChange = output<number>();
  readonly tap = output<void>();

  protected readonly ticks = TICK_MARKS;
  /**
   * Face rotation. null means "ride the bpm input" — the dial is not being
   * dragged and always shows the external value; a number means a drag is in
   * progress and the face is free to accumulate its own rotation.
   */
  private readonly dragRotation = signal<number | null>(null);
  protected readonly rotation = computed(() => this.dragRotation() ?? rotationFor(this.bpm()));
  protected readonly faceTransform = computed(() => `rotate(${this.rotation()} ${CX} ${CY})`);

  private readonly dialRef = viewChild<ElementRef<HTMLElement>>('dial');
  private dragging = false;
  private lastAngle: number | null = null;

  protected onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.lastAngle = this.angleFromEvent(event);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging || this.lastAngle === null) return;
    const angle = this.angleFromEvent(event);
    let delta = angle - this.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    this.lastAngle = angle;

    this.dragRotation.update((r) => (r ?? rotationFor(this.bpm())) + delta);
    this.bpmChange.emit(bpmFor(this.dragRotation() ?? rotationFor(this.bpm())));
    event.preventDefault();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.dragging = false;
    this.lastAngle = null;
    // Settle onto the exact tick for the clamped value, then hand control
    // back to the bpm input.
    const settled = rotationFor(bpmFor(this.dragRotation() ?? rotationFor(this.bpm())));
    this.dragRotation.set(null);
    this.bpmChange.emit(bpmFor(settled));
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

  protected onTapClick(): void {
    this.tap.emit();
  }

  private angleFromEvent(event: PointerEvent): number {
    const el = this.dialRef()?.nativeElement;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const deg = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
  }
}
