import { Component, computed, input, output } from '@angular/core';
import { Scale } from '../../models/scale.model';

interface ScaleGroup {
  readonly label: string;
  readonly scales: readonly Scale[];
}

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
}
