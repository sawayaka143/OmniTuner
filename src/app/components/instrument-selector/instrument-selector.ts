import { Component, input, output } from '@angular/core';
import { Instrument, Tuning } from '../../models/instrument.model';

@Component({
  selector: 'app-instrument-selector',
  templateUrl: './instrument-selector.html',
  styleUrl: './instrument-selector.scss',
})
export class InstrumentSelector {
  readonly instruments = input.required<Instrument[]>();
  readonly selectedInstrumentId = input.required<string>();
  readonly selectedInstrumentIndex = input.required<number>();
  readonly availableTunings = input.required<Tuning[]>();
  readonly selectedTuningId = input.required<string>();
  readonly currentTuning = input.required<Tuning>();
  readonly isDeforming = input(false);
  readonly dropdownOpen = input(false);

  readonly selectInstrument = output<string>();
  readonly selectTuning = output<string>();
  readonly toggleDropdown = output<void>();
  readonly closeDropdown = output<void>();
}
