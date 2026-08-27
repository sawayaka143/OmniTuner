import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { INSTRUMENT_REGISTRY_STORAGE } from '../../services/instrument-registry';
import { InstrumentManager } from './instrument-manager';
import { StringEditor, StringEditorValue } from '../string-editor/string-editor';

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
  template: `
    <app-instrument-manager
      [open]="open()"
      [openInCreateMode]="openInCreateMode()"
      (dismiss)="onDismiss()"
    />
  `,
  imports: [InstrumentManager],
})
class ImHost {
  readonly open = signal(false);
  readonly openInCreateMode = signal(false);
  readonly dismissCount = signal(0);
  onDismiss(): void {
    this.dismissCount.update((n) => n + 1);
  }
}

beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
  }
});

describe('InstrumentManager', () => {
  let fixture: ComponentFixture<ImHost>;
  let host: ImHost;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ImHost],
      providers: [{ provide: INSTRUMENT_REGISTRY_STORAGE, useValue: new MemoryStorage() }],
    });
    fixture = TestBed.createComponent(ImHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => fixture?.destroy());

  const instrumentRows = (): HTMLElement[] =>
    [...fixture.nativeElement.querySelectorAll('.instrument-row')] as HTMLElement[];
  const newListButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.new-instrument-button') as HTMLButtonElement;
  const stringEditor = (): StringEditor | null => {
    const se = fixture.debugElement.query(By.directive(StringEditor));
    return se ? (se.componentInstance as StringEditor) : null;
  };
  const errorText = (): string | null =>
    fixture.nativeElement.querySelector('.field-error')?.textContent ?? null;

  const openInCreateMode = async (): Promise<void> => {
    host.open.set(true);
    host.openInCreateMode.set(true);
    await fixture.whenStable();
  };

  const openInListMode = async (): Promise<void> => {
    host.open.set(true);
    host.openInCreateMode.set(false);
    await fixture.whenStable();
  };

  it('should create', () => {
    expect(fixture.debugElement.query(By.directive(InstrumentManager))).toBeTruthy();
  });

  it('emits dismiss when the close button is clicked', () => {
    host.open.set(true);
    fixture.detectChanges();
    const close = fixture.nativeElement.querySelector(
      '[aria-label="Close instrument manager"]',
    ) as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    expect(host.dismissCount()).toBe(1);
  });

  it('renders the instrument list in list mode (no editor)', async () => {
    await openInListMode();
    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeTruthy();
    expect(newListButton()).toBeTruthy();
    expect(stringEditor()).toBeNull();
  });

  it('switches to the editor when New instrument is clicked', async () => {
    await openInListMode();
    newListButton().click();
    fixture.detectChanges();
    expect(stringEditor()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeNull();
  });

  it('opens directly into the editor when openInCreateMode is true', async () => {
    await openInCreateMode();
    expect(stringEditor()).toBeTruthy();
  });

  it('returns to the list when the composite emits cancel', async () => {
    await openInCreateMode();
    stringEditor()!.cancel.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeTruthy();
    expect(stringEditor()).toBeNull();
  });

  it('persists a new instrument via the registry and returns to the list', async () => {
    await openInCreateMode();
    const value: StringEditorValue = { name: 'My instr', notes: [40, 45, 50, 55, 59, 64] };
    stringEditor()!.save.emit(value);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeTruthy();
    expect(instrumentRows().some((r) => r.textContent?.includes('My instr'))).toBe(true);
  });

  it('excludes the editing instrument from [disallowedNames] (can re-use own name on edit)', async () => {
    await openInCreateMode();
    stringEditor()!.save.emit({ name: 'My instr', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();

    const row = instrumentRows().find((r) => r.textContent?.includes('My instr'));
    const editButton = row!.querySelector('.icon-button') as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    stringEditor()!.save.emit({ name: 'My instr', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeTruthy();
  });

  it('includes other custom instruments in [disallowedNames]', async () => {
    await openInCreateMode();
    stringEditor()!.save.emit({ name: 'First', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    host.openInCreateMode.set(true);
    await fixture.whenStable();
    expect(stringEditor()).toBeTruthy();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'First';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('.editor-form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(stringEditor()).toBeTruthy();
    expect(errorText()).toBe('A name like this already exists.');
  });

  it('persists an edit to an existing custom instrument', async () => {
    await openInCreateMode();
    stringEditor()!.save.emit({ name: 'Renamed later', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();

    const row = instrumentRows().find((r) => r.textContent?.includes('Renamed later'));
    const editButton = row!.querySelector('.icon-button') as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    stringEditor()!.save.emit({ name: 'Renamed', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.instrument-list')).toBeTruthy();
    expect(instrumentRows().some((r) => r.textContent?.includes('Renamed'))).toBe(true);
    expect(instrumentRows().some((r) => r.textContent?.includes('Renamed later'))).toBe(false);
  });

  it('deletes a custom instrument from the list', async () => {
    await openInCreateMode();
    stringEditor()!.save.emit({ name: 'To delete', notes: [40, 45, 50, 55, 59, 64] });
    fixture.detectChanges();
    expect(instrumentRows().some((r) => r.textContent?.includes('To delete'))).toBe(true);

    const row = instrumentRows().find((r) => r.textContent?.includes('To delete'));
    const deleteButton = row!.querySelector('[aria-label="Delete To delete"]') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    expect(instrumentRows().some((r) => r.textContent?.includes('To delete'))).toBe(false);
  });
});
