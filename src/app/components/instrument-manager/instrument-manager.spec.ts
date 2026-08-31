import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';

import {
  INSTRUMENT_REGISTRY_STORAGE,
  InstrumentRegistry,
} from '../../services/instrument-registry';
import { InstrumentManager } from './instrument-manager';
import { StringEditor } from '../string-editor/string-editor';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

@Component({
  selector: 'app-im-host',
  template: `<app-instrument-manager
    [open]="open()"
    [openInCreateMode]="createMode()"
    (dismiss)="dismissed.set(true)"
  />`,
  imports: [InstrumentManager],
})
class ManagerHost {
  readonly open = signal(false);
  readonly createMode = signal(false);
  readonly dismissed = signal(false);
}

describe('InstrumentManager', () => {
  let fixture: ComponentFixture<ManagerHost>;
  let registry: InstrumentRegistry;

  const dialog = (): HTMLDialogElement =>
    fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

  const openDialog = async (createMode = false): Promise<void> => {
    fixture.componentInstance.createMode.set(createMode);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
      this.open = false;
    };
    await TestBed.configureTestingModule({
      imports: [ManagerHost],
      providers: [{ provide: INSTRUMENT_REGISTRY_STORAGE, useValue: new MemoryStorage() }],
    }).compileComponents();
    registry = TestBed.inject(InstrumentRegistry);
    fixture = TestBed.createComponent(ManagerHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const text = (selector: string): string =>
    (fixture.nativeElement.querySelector(selector) as HTMLElement | null)?.textContent?.trim() ??
    '';

  it('should be created and start with a closed dialog in list mode', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(dialog().open).toBe(false);
  });

  it('opens the dialog and lists instruments without edit affordances for built-ins', async () => {
    await openDialog();

    expect(dialog().open).toBe(true);
    expect(text('#manager-title')).toBe('Manage instruments');
    const rows = [...fixture.nativeElement.querySelectorAll('.instrument-row')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].classList.contains('custom')).toBe(false);
    expect(fixture.nativeElement.querySelector('.instrument-actions')).toBeNull();
  });

  it('creates a custom instrument from the string editor and dismisses', async () => {
    await openDialog(true);

    expect(text('#manager-title')).toBe('New instrument');
    expect(fixture.nativeElement.querySelector('app-string-editor')).toBeTruthy();

    const editor = fixture.debugElement.query(By.css('app-string-editor'))
      .componentInstance as StringEditor;
    editor.save.emit({ name: 'Baritone', notes: [35, 40, 45, 50, 54, 59] });
    await fixture.whenStable();
    fixture.detectChanges();

    const created = registry.instruments().find((instrument) => instrument.label === 'Baritone');
    expect(created).toBeTruthy();
    expect(fixture.componentInstance.dismissed()).toBe(true);
  });

  it('edits a custom instrument through the editor', async () => {
    registry.createInstrument('Baritone', 6, [35, 40, 45, 50, 54, 59]);
    await openDialog();

    const edit = fixture.nativeElement.querySelector(
      'button[aria-label="Edit Baritone"]',
    ) as HTMLButtonElement;
    edit.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('#manager-title')).toBe('Edit instrument');
    const editor = fixture.debugElement.query(By.css('app-string-editor'))
      .componentInstance as StringEditor;
    editor.save.emit({ name: 'Bari', notes: [35, 40, 45, 50, 54, 59] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(registry.instruments().some((instrument) => instrument.label === 'Bari')).toBe(true);
    expect(registry.instruments().some((instrument) => instrument.label === 'Baritone')).toBe(
      false,
    );
  });

  it('deletes a custom instrument from the list', async () => {
    registry.createInstrument('Baritone', 6, [35, 40, 45, 50, 54, 59]);
    await openDialog();

    const remove = fixture.nativeElement.querySelector(
      'button[aria-label="Delete Baritone"]',
    ) as HTMLButtonElement;
    remove.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(registry.instruments().some((instrument) => instrument.label === 'Baritone')).toBe(
      false,
    );
  });

  it('emits dismiss from the close button', async () => {
    await openDialog();

    const close = fixture.nativeElement.querySelector(
      'button[aria-label="Close instrument manager"]',
    ) as HTMLButtonElement;
    close.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.dismissed()).toBe(true);
  });
});
