import { Component, computed, input, output, signal } from '@angular/core';
import { parseColorInput } from '../../utils/color-input';

@Component({
  selector: 'app-color-field',
  template: `
    <div class="color-field">
      <input
        class="swatch"
        type="color"
        [value]="pickerValue()"
        [attr.aria-label]="pickerLabel()"
        (input)="onPick($event)"
      />
      <span class="copy" aria-hidden="true">
        <strong>{{ label() }}</strong>
        <span class="value-note" [class.error]="invalid()">{{ statusText() }}</span>
      </span>
      <input
        class="entry"
        type="text"
        spellcheck="false"
        autocomplete="off"
        placeholder="#hex or r, g, b"
        [value]="text()"
        [attr.aria-label]="entryLabel()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        (input)="onType($event)"
        (blur)="onBlur()"
      />
    </div>
  `,
  styleUrl: './color-field.scss',
})
export class ColorField {
  readonly label = input.required<string>();
  readonly value = input<string | null>(null);

  readonly valueChange = output<string>();

  private readonly draft = signal<string | null>(null);

  protected readonly text = computed(() => this.draft() ?? this.value() ?? '');
  protected readonly invalid = computed(() => {
    const draft = this.draft();
    return draft !== null && parseColorInput(draft) === null;
  });
  protected readonly pickerValue = computed(() => this.value() ?? '#000000');

  protected readonly statusText = computed(() => {
    if (this.invalid()) return 'use #hex or r, g, b';
    return this.value() ?? 'auto — follows theme';
  });

  protected readonly pickerLabel = computed(() => `Choose ${this.label()} color`);
  protected readonly entryLabel = computed(() => `${this.label()} color as hex or RGB`);

  protected onType(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const raw = target.value;
    this.draft.set(raw);
    const hex = parseColorInput(raw);
    if (hex) this.valueChange.emit(hex);
  }

  protected onPick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draft.set(null);
    this.valueChange.emit(target.value);
  }

  protected onBlur(): void {
    this.draft.set(null);
  }
}
