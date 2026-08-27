import { Component, computed, input, output } from '@angular/core';
import { Instrument, Tuning } from '../../models/instrument.model';
import { IconButton } from '../../ui/icon-button/icon-button';
import { RovingRadioGroup } from '../../ui/keyboard-nav';

@Component({
  selector: 'app-instrument-selector',
  templateUrl: './instrument-selector.html',
  styleUrl: './instrument-selector.scss',
  imports: [IconButton, RovingRadioGroup],
})
export class InstrumentSelector {
  readonly instruments = input.required<readonly Instrument[]>();
  readonly selectedInstrumentId = input.required<string>();
  readonly selectedInstrumentIndex = input.required<number>();
  readonly availableTunings = input.required<readonly Tuning[]>();
  readonly selectedTuningId = input.required<string>();
  readonly currentTuning = input.required<Tuning>();
  readonly dropdownOpen = input(false);

  readonly plusActive = input(false);

  readonly selectInstrument = output<string>();
  readonly selectTuning = output<string>();
  readonly newCustomTuning = output<void>();
  readonly newInstrument = output<void>();
  readonly editCustomTuning = output<string>();
  readonly deleteCustomTuning = output<string>();
  readonly manageInstruments = output<void>();
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

  protected requestNewInstrument(event: MouseEvent): void {
    event.stopPropagation();
    this.newInstrument.emit();
  }

  protected requestEdit(tuningId: string): void {
    this.editCustomTuning.emit(tuningId);
  }

  protected requestDelete(tuningId: string): void {
    this.deleteCustomTuning.emit(tuningId);
  }

  protected requestManageInstruments(event: MouseEvent): void {
    event.stopPropagation();
    this.manageInstruments.emit();
  }
}
