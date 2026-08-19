import { Component, ElementRef, input, output, viewChild } from '@angular/core';

const ALTERNATE_NOTES: Readonly<Record<string, string>> = {
  'C#': 'D♭',
  Db: 'C♯',
  'D#': 'E♭',
  Eb: 'D♯',
  'F#': 'G♭',
  Gb: 'F♯',
  'G#': 'A♭',
  Ab: 'G♯',
  'A#': 'B♭',
  Bb: 'A♯',
};

let nextMenuId = 0;

@Component({
  selector: 'app-root-note-picker',
  templateUrl: './root-note-picker.html',
  styleUrl: './root-note-picker.scss',
})
export class RootNotePicker {
  readonly notes = input.required<readonly string[]>();
  readonly selected = input.required<string>();
  readonly open = input(false);

  readonly select = output<string>();
  readonly toggle = output<void>();
  readonly close = output<void>();

  protected readonly menuId = `root-note-menu-${nextMenuId++}`;
  protected readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('trigger');
  protected readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected alternative(note: string): string {
    return ALTERNATE_NOTES[note] ?? '';
  }

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
