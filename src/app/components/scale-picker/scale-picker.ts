import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { Scale } from '../../models/scale.model';

interface ScaleGroup {
  readonly label: string;
  readonly scales: readonly Scale[];
}

let nextMenuId = 0;

/**
 * Presentational dropdown for selecting a scale or mode. Mirrors the
 * `.dropdown-wrapper` pattern used by the instrument selector.
 */
@Component({
  selector: 'app-scale-picker',
  templateUrl: './scale-picker.html',
  styleUrl: './scale-picker.scss',
})
export class ScalePicker {
  readonly scales = input.required<readonly Scale[]>();
  readonly selectedId = input.required<string>();
  readonly open = input(false);

  readonly select = output<string>();
  readonly toggle = output<void>();
  readonly close = output<void>();

  protected readonly menuId = `scale-picker-menu-${nextMenuId++}`;
  protected readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('trigger');
  protected readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly selectedLabel = computed(
    () => this.scales().find((s) => s.id === this.selectedId())?.label ?? '',
  );

  protected readonly groupedScales = computed<readonly ScaleGroup[]>(() => {
    const groups = new Map<string, Scale[]>();
    for (const scale of this.scales()) {
      const label = scale.group ?? 'Scales';
      groups.set(label, [...(groups.get(label) ?? []), scale]);
    }
    return [...groups].map(([label, scales]) => ({ label, scales }));
  });

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.open()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.toggle.emit();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const options =
      this.menu()?.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]');
    if (!options || options.length === 0) return;
    const currentIdx = [...options].indexOf(event.target as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[(currentIdx + 1) % options.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[(currentIdx - 1 + options.length) % options.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      options[options.length - 1]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      this.close.emit();
      this.triggerBtn()?.nativeElement.focus();
    }
  }
}
