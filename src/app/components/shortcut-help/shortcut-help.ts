import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { IconButton } from '../../ui/icon-button/icon-button';

interface ShortcutEntry {
  readonly keys: readonly string[];
  readonly description: string;
}

@Component({
  selector: 'app-shortcut-help',
  imports: [IconButton],
  templateUrl: './shortcut-help.html',
  styleUrl: './shortcut-help.scss',
})
export class ShortcutHelp {
  readonly open = input(false);
  readonly dismiss = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly entries: readonly ShortcutEntry[] = [
    { keys: ['←', '→'], description: 'Previous / next page' },
    { keys: ['?', '/'], description: 'Toggle this help' },
    { keys: ['Esc'], description: 'Close dialogs' },
    { keys: ['Space'], description: 'Start / stop metronome' },
    { keys: ['T'], description: 'Tap tempo' },
    { keys: ['↑', '↓'], description: 'Tempo ±1' },
    { keys: ['Shift', '↑', '↓'], description: 'Tempo ±5' },
  ];

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }
}
