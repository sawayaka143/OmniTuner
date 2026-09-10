import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import {
  AccidentalPreference,
  LabelMode,
  ScaleFretCount,
} from '../../models/scale-preferences.model';
import { Toggle } from '../../ui/toggle/toggle';
import { RovingRadioGroup } from '../../ui/keyboard-nav';

@Component({
  selector: 'app-scale-options',
  templateUrl: './scale-options.html',
  styleUrl: './scale-options.scss',
  imports: [Toggle, RovingRadioGroup],
  host: {
    '(document:mousedown)': 'onDocumentMouseDown($event)',
  },
})
export class ScaleOptions {
  private readonly elementRef = inject(ElementRef);
  private readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('labelTrigger');

  readonly accidental = input<AccidentalPreference>('sharp');
  readonly fretCount = input<ScaleFretCount>(12);
  readonly labelMode = input<LabelMode>('note-names');
  readonly showOutsideScale = input(false);

  readonly accidentalChange = output<AccidentalPreference>();
  readonly fretCountChange = output<ScaleFretCount>();
  readonly labelModeChange = output<LabelMode>();
  readonly showOutsideScaleChange = output<boolean>();

  protected readonly fretChoices: readonly ScaleFretCount[] = [12, 15, 21];
  protected readonly labelOptions: { value: LabelMode; label: string }[] = [
    { value: 'note-names', label: 'Note names' },
    { value: 'scale-degrees', label: 'Scale degrees' },
  ];
  protected readonly labelOpen = signal(false);

  protected chooseAccidental(value: AccidentalPreference): void {
    if (this.accidental() === value) return;
    this.accidentalChange.emit(value);
  }

  protected chooseFretCount(value: ScaleFretCount): void {
    if (this.fretCount() === value) return;
    this.fretCountChange.emit(value);
  }

  protected get currentLabel(): string {
    return this.labelOptions.find((opt) => opt.value === this.labelMode())?.label ?? 'Note names';
  }

  protected toggleLabelDropdown(): void {
    this.labelOpen.update((v) => !v);
  }

  protected selectLabel(mode: LabelMode): void {
    this.labelModeChange.emit(mode);
    this.labelOpen.set(false);
    this.triggerBtn()?.nativeElement.focus();
  }

  protected onLabelKeydown(event: KeyboardEvent): void {
    if (!this.labelOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.labelOpen.set(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.labelOpen.set(false);
      this.triggerBtn()?.nativeElement.focus();
    } else if (event.key === 'Tab') {
      this.labelOpen.set(false);
    }
  }

  protected onDocumentMouseDown(event: MouseEvent): void {
    if (this.labelOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.labelOpen.set(false);
    }
  }
}
