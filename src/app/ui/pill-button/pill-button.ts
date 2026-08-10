import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pill-button',
  template: `
    <button
      [type]="type()"
      class="pill-button"
      [class.primary]="variant() === 'primary'"
      [class.active]="pressed() !== null"
      [attr.aria-pressed]="pressed() !== null ? pressed() : null"
      [disabled]="disabled()"
      (click)="activate.emit()"
    >
      @if (displayIcon(); as icon) {
        <span class="material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
      }
      {{ label() }}
    </button>
  `,
  styleUrl: './pill-button.scss',
})
export class PillButton {
  readonly variant = input<'ghost' | 'primary'>('ghost');
  readonly label = input.required<string>();
  readonly iconOn = input<string>();
  readonly iconOff = input<string>();
  /** When non-null, exposes `aria-pressed` and adds `.active` for visual press. */
  readonly pressed = input<boolean | null>(null);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly activate = output<void>();

  protected readonly displayIcon = computed<string | null>(() => {
    const on = this.iconOn();
    if (!on) return null;
    const off = this.iconOff();
    return off && this.pressed() === false ? off : on;
  });
}