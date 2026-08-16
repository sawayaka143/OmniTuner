import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';

let nextListboxId = 0;

/**
 * Accessible listbox dropdown: a pill trigger that opens a floating
 * `role="listbox"` menu of `role="option"` items. The parent owns the `open`
 * signal; the primitive emits `toggle` (trigger clicked) and `select` (option
 * chosen). Items may be grouped via `optionGroup` (first-seen order).
 *
 * Keyboard: Enter/Space/ArrowDown on the trigger opens the menu; Arrow keys
 * move between options, Enter/Space selects, Escape or Tab closes and returns
 * focus to the trigger.
 */
@Component({
  selector: 'app-listbox',
  template: `
    <div class="dropdown-wrapper">
      <button
        #trigger
        type="button"
        class="btn"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        [attr.aria-controls]="open() ? menuId : null"
        (click)="toggle.emit(); $event.stopPropagation()"
        (keydown)="onTriggerKeydown($event)"
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
          #menu
          [id]="menuId"
          class="dropdown-menu card"
          role="listbox"
          [attr.aria-label]="ariaLabel()"
          (click)="$event.stopPropagation()"
          (keydown)="onMenuKeydown($event)"
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

  protected readonly menuId = `app-listbox-menu-${nextListboxId++}`;
  protected readonly triggerBtn = viewChild<ElementRef<HTMLElement>>('trigger');
  protected readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

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

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.open()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.toggle.emit();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const options =
      this.menu()?.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]');
    if (!options || options.length === 0) return;
    const currentIdx = [...options].indexOf(event.target as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = options[(currentIdx + 1) % options.length];
      next?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = options[(currentIdx - 1 + options.length) % options.length];
      next?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      options[options.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
    } else if (event.key === 'Tab') {
      this.closeMenu();
    }
  }

  protected closeMenu(): void {
    if (this.open()) {
      this.toggle.emit();
      this.triggerBtn()?.nativeElement.focus();
    }
  }

  protected isSelected(option: T): boolean {
    return this.value() === option;
  }
}
