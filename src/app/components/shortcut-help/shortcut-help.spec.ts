import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortcutHelp } from './shortcut-help';

@Component({
  selector: 'app-sh-host',
  template: `<app-shortcut-help [open]="open()" (dismiss)="close()" />`,
  imports: [ShortcutHelp],
})
class ShHost {
  readonly open = signal(false);
  closed = false;
  close(): void {
    this.closed = true;
    this.open.set(false);
  }
}

describe('ShortcutHelp', () => {
  let fixture: ComponentFixture<ShHost>;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
      this.open = false;
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShHost] }).compileComponents();
    fixture = TestBed.createComponent(ShHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  const dialog = (): HTMLDialogElement =>
    fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

  it('renders one entry per documented shortcut', () => {
    const entries = fixture.nativeElement.querySelectorAll('.shortcut-entry');
    expect(entries.length).toBe(7);
  });

  it('opens and closes the dialog through the open input', async () => {
    expect(dialog().open).toBe(false);

    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialog().open).toBe(true);

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialog().open).toBe(false);
  });

  it('emits dismiss from the close button', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const close = fixture.nativeElement.querySelector(
      '.shortcut-header app-icon-button button',
    ) as HTMLButtonElement;
    close.click();

    expect(fixture.componentInstance.closed).toBe(true);
  });
});
