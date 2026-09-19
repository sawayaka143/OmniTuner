import {
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconButton } from '../../ui/icon-button/icon-button';
import { createDialogExit } from '../../ui/dialog-exit';

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

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly exit = createDialogExit(this.document.defaultView, () => this.dismiss.emit());

  protected readonly entries: readonly ShortcutEntry[] = [
    { keys: ['Ctrl', 'K'], description: 'Command palette' },
    { keys: ['←', '→'], description: 'Previous / next page' },
    { keys: ['?', '/'], description: 'Toggle this help' },
    { keys: ['Esc'], description: 'Close dialogs' },
    { keys: ['Space'], description: 'Start / stop metronome' },
    { keys: ['T'], description: 'Tap tempo' },
    { keys: ['↑', '↓'], description: 'Tempo ±1' },
    { keys: ['Shift', '↑', '↓'], description: 'Tempo ±5' },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.exit.destroy());

    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    const dialog = this.dialog()?.nativeElement;
    if (!dialog?.open || this.exit.closing()) return;
    this.exit.begin();
  }

  protected onDialogAnimationend(event: AnimationEvent): void {
    if (this.exit.ownsAnimation(event)) this.exit.finish();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }
}
