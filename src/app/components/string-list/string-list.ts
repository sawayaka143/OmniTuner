import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TuningString } from '../../models/instrument.model';

@Component({
  selector: 'app-string-list',
  templateUrl: './string-list.html',
  styleUrl: './string-list.scss',
})
export class StringList {
  readonly strings = input.required<readonly TuningString[]>();
  readonly activeString = input<string | null>(null);
  readonly inTune = input(false);
  readonly tunedStrings = input<readonly string[]>([]);
  readonly select = output<number>();

  protected readonly focusIndex = signal<number | null>(null);
  protected readonly container = viewChild<ElementRef<HTMLElement>>('group');

  protected readonly activeIndex = computed(() =>
    this.strings().findIndex((s) => s.name === this.activeString()),
  );

  protected onKeydown(event: KeyboardEvent): void {
    const btns =
      this.container()?.nativeElement.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!btns || btns.length === 0) return;
    const currentIdx = btns ? [...btns].indexOf(event.target as HTMLButtonElement) : -1;
    const lastIdx = btns.length - 1;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = btns[Math.min(currentIdx + 1, lastIdx)];
      next?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = btns[Math.max(currentIdx - 1, 0)];
      next?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      btns[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      btns[lastIdx]?.focus();
    }
  }

  protected onFocus(index: number): void {
    this.focusIndex.set(index);
  }

  protected tabIndexFor(index: number): number {
    const focused = this.focusIndex() !== null ? this.focusIndex() : this.activeIndex();
    return focused === index ? 0 : -1;
  }
}
