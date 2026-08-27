import { AfterViewInit, Directive, ElementRef, HostListener, inject, input } from '@angular/core';

@Directive({
  selector: '[appRovingRadioGroup]',
})
export class RovingRadioGroup implements AfterViewInit {
  readonly appRovingRadioGroup = input(true);

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    if (!this.appRovingRadioGroup()) return;
    const radios = this.radios(this.hostEl.nativeElement);
    const activeIdx = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    this.updateTabindex(radios, activeIdx === -1 ? 0 : activeIdx);
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.appRovingRadioGroup()) return;
    const host = event.currentTarget as HTMLElement;
    const radios = this.radios(host).filter((r) => !r.disabled);
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
    radios[next]?.click();
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
