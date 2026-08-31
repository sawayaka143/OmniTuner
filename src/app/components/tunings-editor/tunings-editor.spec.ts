import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StringEditor } from '../string-editor/string-editor';
import { TuningEditor } from './tunings-editor';

@Component({
  selector: 'app-te-host',
  template: `
    <app-tuning-editor
      [open]="open()"
      [mode]="mode()"
      instrumentLabel="Guitar"
      [initialName]="name()"
      [initialNotes]="notes()"
      (dismiss)="dismissed.set(true)"
      (save)="saved.set($event)"
    />
  `,
  imports: [TuningEditor],
})
class EditorHost {
  readonly open = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');
  readonly name = signal('Drop D');
  readonly notes = signal<readonly number[]>([38, 45, 50, 55, 59, 64]);
  readonly dismissed = signal(false);
  readonly saved = signal<{ readonly name: string; readonly notes: readonly number[] } | null>(
    null,
  );
}

describe('TuningEditor', () => {
  let fixture: ComponentFixture<EditorHost>;

  const dialog = (): HTMLDialogElement =>
    fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

  beforeEach(async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
      this.open = false;
    };
    await TestBed.configureTestingModule({ imports: [EditorHost] }).compileComponents();
    fixture = TestBed.createComponent(EditorHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const text = (selector: string): string =>
    (fixture.nativeElement.querySelector(selector) as HTMLElement | null)?.textContent?.trim() ??
    '';

  it('should be created and start with a closed dialog', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(dialog().open).toBe(false);
  });

  it('opens in create mode with the instrument kicker and title', async () => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialog().open).toBe(true);
    expect(text('.editor-kicker')).toBe('Guitar');
    expect(text('#tuning-editor-title')).toBe('New custom tuning');
    expect(fixture.nativeElement.querySelector('app-string-editor')).toBeTruthy();
  });

  it('shows the edit title in edit mode', async () => {
    fixture.componentInstance.mode.set('edit');
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('#tuning-editor-title')).toBe('Edit custom tuning');
  });

  it('emits dismiss from the close button and closes', async () => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    const close = fixture.nativeElement.querySelector(
      'button[aria-label="Close tuning editor"]',
    ) as HTMLButtonElement;
    close.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.dismissed()).toBe(true);
  });

  it('bubbles save events from the string editor', async () => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    const editor = fixture.debugElement.query(By.css('app-string-editor'))
      .componentInstance as StringEditor;
    editor.save.emit({ name: 'D Standard', notes: [38, 45, 50, 55, 59, 64] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.saved()).toEqual({
      name: 'D Standard',
      notes: [38, 45, 50, 55, 59, 64],
    });
  });

  it('emits dismiss when the string editor is cancelled', async () => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    const editor = fixture.debugElement.query(By.css('app-string-editor'))
      .componentInstance as StringEditor;
    editor.cancel.emit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.dismissed()).toBe(true);
  });
});
