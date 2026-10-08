import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      class="toggle-button"
      [class.inline]="inline()"
      [class.prominent]="prominent()"
      [class.active]="checked()"
      [attr.role]="inline() ? null : 'switch'"
      [attr.aria-checked]="inline() ? null : checked()"
      [attr.aria-pressed]="inline() ? checked() : null"
      [attr.aria-label]="inline() ? null : label()"
      [attr.title]="inline() || title() === null ? null : title()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      @if (inline()) {
        {{ label() }}
      }
      <span class="toggle-lamp" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './toggle.scss',
})
export class Toggle {
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly inline = input(false);
  readonly prominent = input(false);
  readonly title = input<string | null>(null);
  readonly disabled = input(false);
  readonly change = output<boolean>();

  protected toggle(): void {
    if (this.disabled()) return;
    this.change.emit(!this.checked());
  }
}
