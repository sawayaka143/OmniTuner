import { Component, computed, input, output } from '@angular/core';

let nextFieldId = 0;

/**
 * Single-line text or number input with a visible label and optional inline
 * validation messaging. Accessibility is baked in: a generated `id` links the
 * `<label for>`, `aria-invalid` follows `[invalid]`/`[errorMessage]`, and any
 * error/hint becomes `aria-describedby`.
 */
@Component({
  selector: 'app-text-field',
  template: `
    <label class="field-label" [class]="labelClass()" [attr.for]="fieldId">{{ label() }}</label>
    <input
      [id]="fieldId"
      class="field"
      [class]="inputClass()"
      [type]="type()"
      [attr.placeholder]="placeholder() || null"
      [attr.minlength]="minlength() ?? null"
      [attr.maxlength]="maxlength() ?? null"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.step]="step() ?? null"
      [required]="required()"
      [attr.autofocus]="autofocus() ? '' : null"
      [attr.spellcheck]="spellcheck() ? 'true' : 'false'"
      [attr.autocomplete]="autocomplete()"
      [value]="value()"
      [attr.aria-invalid]="effectiveInvalid() ? 'true' : null"
      [attr.aria-describedby]="describedBy() || null"
      (input)="onInput($event)"
      (keydown.enter)="enter.emit()"
    />
    @if (errorMessage()) {
      <p [id]="errorId" class="field-error">{{ errorMessage() }}</p>
    } @else if (hint()) {
      <p
        [id]="hintId"
        class="hint"
        [class.good]="hintTone() === 'good'"
        [class.bad]="hintTone() === 'bad'"
      >
        {{ hint() }}
      </p>
    }
  `,
  styleUrl: './text-field.scss',
})
export class TextField {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly type = input<'text' | 'number'>('text');
  readonly invalid = input(false);
  readonly errorMessage = input<string>();
  readonly hint = input<string>();
  readonly hintTone = input<'good' | 'bad' | 'neutral'>('neutral');
  readonly placeholder = input('');
  readonly minlength = input<number>();
  readonly maxlength = input<number>();
  readonly min = input<number>();
  readonly max = input<number>();
  readonly step = input<number>();
  readonly required = input(false);
  readonly autofocus = input(false);
  readonly spellcheck = input(false);
  readonly autocomplete = input<string>('off');
  /** Optional extra class applied to the `<label>`. */
  readonly labelClass = input('');
  /** Optional extra class applied to the `<input>`. */
  readonly inputClass = input('');

  readonly valueChange = output<string>();
  readonly enter = output<void>();

  protected readonly fieldId = `app-text-field-${nextFieldId++}`;
  protected readonly errorId = `${this.fieldId}-error`;
  protected readonly hintId = `${this.fieldId}-hint`;

  protected readonly effectiveInvalid = computed(() => this.invalid() || !!this.errorMessage());

  protected readonly describedBy = computed(() => {
    if (this.errorMessage()) return this.errorId;
    if (this.hint()) return this.hintId;
    return '';
  });

  protected onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.valueChange.emit(target.value);
  }
}
