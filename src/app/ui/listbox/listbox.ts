import {
  Component,
  DestroyRef,
  DOCUMENT,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

let nextListboxId = 0;

const NATIVE_SELECT_QUERY = '(max-width: 760px)';

@Component({
  selector: 'app-listbox',
  template: `
    <div class="dropdown-wrapper">
      @if (useNativeSelect()) {
        <span class="btn native-trigger" aria-hidden="true">
          <span class="button-copy">
            @if (triggerKicker()) {
              <span class="button-kicker">{{ triggerKicker() }}</span>
            }
            <span class="value-wrap">
              <strong>{{ triggerLabel() }}</strong>
            </span>
          </span>
          <span class="app-icon ti ti-chevron-down dropdown-icon" aria-hidden="true"></span>
        </span>
        <select
          class="native-select"
          [attr.aria-label]="ariaLabel()"
          (change)="onNativeChange($event)"
        >
          @for (group of grouped(); track group.label ?? '') {
            @if (group.label) {
              <optgroup [label]="group.label">
                @for (option of group.items; track nativeValue(option)) {
                  <option [value]="nativeValue(option)" [selected]="isSelected(option)">
                    {{ nativeOptionLabel(option) }}
                  </option>
                }
              </optgroup>
            } @else {
              @for (option of group.items; track nativeValue(option)) {
                <option [value]="nativeValue(option)" [selected]="isSelected(option)">
                  {{ nativeOptionLabel(option) }}
                </option>
              }
            }
          }
        </select>
      } @else {
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
            class="app-icon ti ti-chevron-down dropdown-icon"
            [class.rotated]="open()"
            aria-hidden="true"
          ></span>
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
      }
    </div>
  `,
  styleUrl: './listbox.scss',
})
export class Listbox<T> {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

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

  // On phones the listbox renders a real <select> so the picker popup is the
  // platform's own UI. The custom menu remains the desktop presentation.
  protected readonly useNativeSelect = signal(false);

  constructor() {
    const view = this.document.defaultView;
    if (!view?.matchMedia) return;
    try {
      const media = view.matchMedia(NATIVE_SELECT_QUERY);
      this.useNativeSelect.set(media.matches);
      const listener = (event: MediaQueryListEvent): void => {
        this.useNativeSelect.set(event.matches);
      };
      media.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', listener));
    } catch {
      // matchMedia unavailable — keep the custom menu everywhere.
    }
  }

  protected readonly grouped = computed(() => {
    const items = this.options();
    const groupOf = this.optionGroup();
    const buckets = new Map<string, T[]>();
    const order: string[] = [];
    for (const item of items) {
      const label = groupOf(item) ?? '';
      if (!buckets.has(label)) {
        order.push(label);
        buckets.set(label, []);
      }
      buckets.get(label)!.push(item);
    }
    if (order.length <= 1 && (order[0] ?? '') === '') {
      return [{ label: null as string | null, items }];
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
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLButtonElement).click();
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

  protected nativeValue(option: T): string {
    return String(this.trackByFn()(option));
  }

  protected nativeOptionLabel(option: T): string {
    const label = this.optionLabel()(option);
    const alt = this.optionAlt()?.(option);
    return alt ? `${label} — ${alt}` : label;
  }

  protected onNativeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const option = this.options().find((candidate) => this.nativeValue(candidate) === value);
    if (option !== undefined) this.select.emit(option);
  }
}
