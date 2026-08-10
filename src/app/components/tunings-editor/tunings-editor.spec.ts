import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { StringEditor, StringEditorValue } from '../string-editor/string-editor';
import { TuningEditor } from './tunings-editor';

@Component({
  selector: 'app-te-host',
  template: `
    <app-tuning-editor
      [open]="open()"
      [mode]="mode()"
      [instrumentLabel]="instrumentLabel()"
      [initialName]="initialName()"
      [initialNotes]="initialNotes()"
      (save)="onSave($event)"
      (preview)="onPreview($event)"
      (dismiss)="onDismiss()"
    />
  `,
  imports: [TuningEditor],
})
class TeHost {
  readonly open = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');
  readonly instrumentLabel = signal('');
  readonly initialName = signal('');
  readonly initialNotes = signal<readonly number[]>([]);
  readonly saved = signal<StringEditorValue | null>(null);
  readonly previews = signal<readonly number[]>([]);
  readonly dismissCount = signal(0);
  onSave(v: StringEditorValue): void {
    this.saved.set(v);
  }
  onPreview(n: readonly number[]): void {
    this.previews.set(n);
  }
  onDismiss(): void {
    this.dismissCount.update((n) => n + 1);
  }
}

describe('TuningEditor', () => {
  let fixture: ComponentFixture<TeHost>;
  let host: TeHost;
  let editor: TuningEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TeHost] }).compileComponents();
    fixture = TestBed.createComponent(TeHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
    const debug = fixture.debugElement.query(By.directive(TuningEditor));
    editor = debug.componentInstance as TuningEditor;
  });

  afterEach(() => fixture?.destroy());

  const stringEditor = (): StringEditor => {
    const seDebug = fixture.debugElement.query(By.directive(StringEditor));
    return seDebug.componentInstance as StringEditor;
  };

  it('should create', () => {
    expect(editor).toBeTruthy();
  });

  it('renders the instrument label kicker when provided', () => {
    host.instrumentLabel.set('Guitar');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.editor-kicker')?.textContent).toBe('Guitar');
  });

  it('hides the kicker when no instrument label is set', () => {
    expect(fixture.nativeElement.querySelector('.editor-kicker')).toBeNull();
  });

  it('forwards the composite save event up to its parent', () => {
    stringEditor().save.emit({ name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] });
    expect(host.saved()).toEqual({ name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] });
  });

  it('forwards the composite preview event up to its parent', () => {
    stringEditor().preview.emit([40, 45]);
    expect(host.previews()).toEqual([40, 45]);
  });

  it('emits dismiss when the composite cancels', () => {
    expect(host.dismissCount()).toBe(0);
    stringEditor().cancel.emit();
    expect(host.dismissCount()).toBe(1);
  });

  it('forbids string-count change (tunings always match the instrument)', () => {
    expect(fixture.nativeElement.querySelector('.string-count-row')).toBeNull();
  });

  it('shows the Tuning name label, not the default Instrument name', () => {
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.textContent).toBe('Tuning name');
  });
});