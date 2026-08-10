import { Component, computed, input, output } from '@angular/core';

/**
 * Accessible listbox dropdown: a pill trigger that opens a floating
 * `role="listbox"` menu of `role="option"` items. The parent owns the `open`
 * signal (matching the previous bespoke implementations); the primitive emits
 * `toggle` (trigger clicked) and `select` (an option chosen).
 *
 * Items may be grouped: pass an `optionGroup` accessor that returns a label
 * string for items that should sit under a group header, or `null` for ungrouped
 * items. Groups render in first-seen insertion order.
 */
@Component({
  selector: 'app-listbox',
  template: `
    <div class="dropdown-wrapper">
      <button
        type="button"
        class="btn"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle.emit(); $event.stopPropagation()"
      >
        <span class="button-copy">
          @if (triggerKicker()) {
            <span class="button-kicker">{{ triggerKicker() }}</span>
          }
          <span class="value-wrap">
            <strong>{{ triggerLabel() }}</strong>
          </span>
        </span>
        <span
          class="material-symbols-outlined dropdown-icon"
          [class.rotated]="open()"
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      @if (open()) {
        <div
          class="dropdown-menu card"
          role="listbox"
          [attr.aria-label]="ariaLabel()"
          (click)="$event.stopPropagation()"
        >
          @for (group of grouped(); track group.label ?? '') {
            @if (group.label) {
              <div class="dropdown-group">{{ group.label }}</div>
            }
            @for (option of group.items; track trackByFn()(option)) {
              <button
                type="button"
                role="option"
                class="dropdown-item"
                [class.selected]="isSelected(option)"
                [attr.aria-selected]="isSelected(option)"
                (click)="select.emit(option)"
              >
                <span>{{ optionLabel()(option) }}</span>
                @if (optionAlt()?.(option); as alt) {
                  <span class="item-alt">{{ alt }}</span>
                }
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styleUrl: './listbox.scss',
})
export class Listbox<T> {
  readonly options = input.required<readonly T[]>();
  readonly value = input.required<T>();
  readonly ariaLabel = input.required<string>();
  readonly triggerLabel = input.required<string>();
  readonly triggerKicker = input<string>();
  readonly optionLabel = input.required<(o: T) => string>();
  readonly optionAlt = input<(o: T) => string | null>();
  readonly optionGroup = input<(o: T) => string | null>(() => null);
  readonly trackByFn = input.required<(o: T) => unknown>();
  readonly open = input.required<boolean>();

  readonly toggle = output<void>();
  readonly select = output<T>();

  protected readonly grouped = computed(() => {
    const items = this.options();
    const groupOf = this.optionGroup();
    if (!groupOf) return [{ label: null as string | null, items }];
    const order: string[] = [];
    const buckets = new Map<string, T[]>();
    for (const item of items) {
      const label = groupOf(item) ?? '';
      if (!buckets.has(label)) {
        order.push(label);
        buckets.set(label, []);
      }
      buckets.get(label)!.push(item);
    }
    return order.map((label) => ({ label: label || null, items: buckets.get(label)! }));
  });

  protected isSelected(option: T): boolean {
    return this.value() === option;
  }
}