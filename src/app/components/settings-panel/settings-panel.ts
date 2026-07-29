import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

interface AccentOption {
  readonly name: string;
  readonly value: string;
}

@Component({
  selector: 'app-settings-panel',
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
})
export class SettingsPanel {
  readonly open = input(false);
  readonly accent = input('#779900');
  readonly rootNoteColor = input('#ffffff');
  readonly noteColor = input('#2e2e28');
  readonly workbenchScale = input(1);

  readonly accentChange = output<string>();
  readonly rootNoteColorChange = output<string>();
  readonly noteColorChange = output<string>();
  readonly workbenchScaleChange = output<number>();
  readonly workbenchScaleReset = output<void>();
  readonly dismiss = output<void>();

  protected readonly accentOptions: readonly AccentOption[] = [
    { name: 'Root green', value: '#779900' },
    { name: 'Third amber', value: '#ff9900' },
    { name: 'Fifth blue', value: '#227799' },
    { name: 'Seventh orange', value: '#ee6600' },
    { name: 'Extension red', value: '#ee0000' },
    { name: 'Altered magenta', value: '#bb3366' },
  ];

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected chooseAccent(value: string): void {
    this.accentChange.emit(value);
  }

  protected onCustomAccent(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.chooseAccent(target.value);
  }

  protected onRootNoteColor(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.rootNoteColorChange.emit(target.value);
  }

  protected onNoteColor(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.noteColorChange.emit(target.value);
  }

  protected onWorkbenchScale(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.workbenchScaleChange.emit(Number(target.value));
  }

  protected requestDismiss(event?: Event): void {
    event?.preventDefault();
    this.dismiss.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.requestDismiss();
  }
}
