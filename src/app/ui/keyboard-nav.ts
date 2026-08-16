import { Directive, HostListener, input } from '@angular/core';

/**
 * Adds radiogroup keyboard navigation to a host with `role="radiogroup"`:
 * Arrow keys move between radio buttons, Home/End jump to the first/last, and
 * only the checked (or last-focused) button is a Tab stop.
 */
@Directive({
  selector: '[appRovingRadioGroup]',
})
export class RovingRadioGroup {
  /** Whether navigation is enabled (no-op when disabled). */
  readonly appRovingRadioGroup = input(true);

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.appRovingRadioGroup()) return;
    const host = event.currentTarget as HTMLElement;
    const radios = this.radios(host);
    if (radios.length === 0) return;
    const current = radios.indexOf(event.target as HTMLButtonElement);

    let next = current;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      next = (current + 1) % radios.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      next = (current - 1 + radios.length) % radios.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = radios.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    this.focusRadio(radios, next);
  }

  @HostListener('focusin', ['$event'])
  protected onFocusIn(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    const radios = this.radios(host);
    const target = event.target as HTMLElement;
    const idx = radios.indexOf(target as HTMLButtonElement);
    if (idx === -1) return;
    this.updateTabindex(radios, idx);
  }

  private radios(host: HTMLElement): HTMLButtonElement[] {
    return [...host.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
  }

  private focusRadio(radios: HTMLButtonElement[], index: number): void {
    this.updateTabindex(radios, index);
    radios[index]?.focus();
  }

  private updateTabindex(radios: HTMLButtonElement[], active: number): void {
    radios.forEach((radio, i) => {
      radio.tabIndex = i === active ? 0 : -1;
    });
  }
}
