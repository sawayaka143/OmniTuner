import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-icon-button',
  template: `
    <button
      type="button"
      class="icon-button"
      [class.size-sm]="size() === 'sm'"
      [class.danger]="danger()"
      [class.ghost]="variant() === 'ghost'"
      [attr.aria-label]="label()"
      [attr.title]="showTitle() ? label() : null"
      [disabled]="disabled()"
      (click)="onActivate($event)"
    >
      <span [class]="'app-icon ti ti-' + icon()" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './icon-button.scss',
})
export class IconButton {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly size = input<'md' | 'sm'>('md');
  readonly variant = input<'solid' | 'ghost'>('solid');
  readonly danger = input(false);
  readonly showTitle = input(false);
  readonly disabled = input(false);
  readonly stopClickPropagation = input(false);
  readonly activate = output<void>();

  protected onActivate(event: MouseEvent): void {
    if (this.stopClickPropagation()) event.stopPropagation();
    this.activate.emit();
  }
}
