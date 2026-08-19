import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { AccidentalPreference } from '../../models/scale-preferences.model';
import { midiDisplayName } from '../../data/note-display-names';

let nextTuningSelectorId = 0;
import { IconButton } from '../../ui/icon-button/icon-button';

export interface TuningOption {
  readonly id: string;
  readonly name: string;
  readonly notes: readonly number[];
  readonly kind: 'preset' | 'custom';
}

@Component({
  selector: 'app-tuning-selector',
  templateUrl: './tuning-selector.html',
  styleUrl: './tuning-selector.scss',
  imports: [IconButton],
})
export class TuningSelector {
  readonly presets = input.required<readonly TuningOption[]>();
  readonly savedTunings = input.required<readonly TuningOption[]>();
  readonly selectedId = input<string | null>(null);
  readonly selectedName = input.required<string>();
  readonly accidental = input<AccidentalPreference>('sharp');
  readonly open = input(false);

  protected readonly menuId = `tuning-selector-menu-${nextTuningSelectorId++}`;

  readonly select = output<string>();
  readonly edit = output<string>();
  readonly create = output<void>();
  readonly delete = output<string>();
  readonly toggle = output<void>();

  protected readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('trigger');
  protected readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  protected notesLabel(notes: readonly number[]): string {
    return notes.map((midi) => midiDisplayName(midi, this.accidental())).join(' ');
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.open()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.toggle.emit();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const options = this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[data-nav-item]');
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
      this.toggle.emit();
      this.triggerBtn()?.nativeElement.focus();
    } else if (event.key === 'Tab') {
      this.toggle.emit();
      this.triggerBtn()?.nativeElement.focus();
    }
  }
}
