import { Component, computed, input, output } from '@angular/core';
import { Instrument, Tuning } from '../../models/instrument.model';

@Component({
  selector: 'app-instrument-selector',
  templateUrl: './instrument-selector.html',
  styleUrl: './instrument-selector.scss',
})
export class InstrumentSelector {
  readonly instruments = input.required<readonly Instrument[]>();
  readonly selectedInstrumentId = input.required<string>();
  readonly selectedInstrumentIndex = input.required<number>();
  readonly availableTunings = input.required<readonly Tuning[]>();
  readonly selectedTuningId = input.required<string>();
  readonly currentTuning = input.required<Tuning>();
  readonly isDeforming = input(false);
  readonly dropdownOpen = input(false);

  readonly selectInstrument = output<string>();
  readonly selectTuning = output<string>();
  readonly newCustomTuning = output<void>();
  readonly editCustomTuning = output<string>();
  readonly deleteCustomTuning = output<string>();
  readonly toggleDropdown = output<void>();
  readonly closeDropdown = output<void>();

  protected readonly presetTunings = computed(() =>
    this.availableTunings().filter((tuning) => tuning.kind !== 'custom'),
  );
  protected readonly customTunings = computed(() =>
    this.availableTunings().filter((tuning) => tuning.kind === 'custom'),
  );

  protected chooseTuning(event: MouseEvent, tuningId: string): void {
    event.stopPropagation();
    this.selectTuning.emit(tuningId);
  }

  protected requestNewCustomTuning(event: MouseEvent): void {
    event.stopPropagation();
    this.newCustomTuning.emit();
  }

  protected requestEdit(event: MouseEvent, tuningId: string): void {
    event.stopPropagation();
    this.editCustomTuning.emit(tuningId);
  }

  protected requestDelete(event: MouseEvent, tuningId: string): void {
    event.stopPropagation();
    this.deleteCustomTuning.emit(tuningId);
  }
}
