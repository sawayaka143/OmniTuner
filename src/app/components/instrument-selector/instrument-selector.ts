import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
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

  protected readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('trigger');
  protected readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly presetTunings = computed(() =>
    this.availableTunings().filter((tuning) => tuning.kind !== 'custom'),
  );
  protected readonly customTunings = computed(() =>
    this.availableTunings().filter((tuning) => tuning.kind === 'custom'),
  );

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (!this.dropdownOpen()) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.toggleDropdown.emit();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown.emit();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const menu = this.menu()?.nativeElement;
    if (!menu) return;
    const options = menu.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled])',
    );
    if (!options || options.length === 0) return;
    const currentIdx = [...options].indexOf(event.target as HTMLElement);

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
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown.emit();
      this.triggerBtn()?.nativeElement.focus();
    } else if (event.key === 'Tab') {
      this.closeDropdown.emit();
    }
  }

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
