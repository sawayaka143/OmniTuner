import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { axe } from 'vitest-axe';

import { ScalePreferences } from '../../services/scale-preferences';
import { ThemeService } from '../../services/theme.service';
import { CommandPalette } from './command-palette';

@Component({
  selector: 'app-cp-host',
  template: `<app-command-palette [open]="open()" (dismiss)="close()" />`,
  imports: [CommandPalette],
})
class CpHost {
  readonly open = signal(false);
  closed = false;
  close(): void {
    this.closed = true;
    this.open.set(false);
  }
}

describe('CommandPalette', () => {
  let fixture: ComponentFixture<CpHost>;
  let preferences: ScalePreferences;
  let themeService: ThemeService;
  let router: Router;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
      this.open = false;
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CpHost],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CpHost);
    preferences = TestBed.inject(ScalePreferences);
    themeService = TestBed.inject(ThemeService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  const openPalette = async (): Promise<void> => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const options = (): HTMLLIElement[] => [
    ...fixture.nativeElement.querySelectorAll('.palette-option'),
  ];

  it('opens and closes the dialog through the open input', async () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    await openPalette();
    expect(dialog.open).toBe(true);

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
  });

  it('lists navigation, root note, and theme commands', async () => {
    await openPalette();
    const labels = options().map((option) => option.textContent ?? '');
    expect(labels.some((label) => label.includes('Go to Tuner'))).toBe(true);
    expect(labels.some((label) => label.includes('Root note: C'))).toBe(true);
    expect(labels.some((label) => label.includes('Toggle theme'))).toBe(true);
    expect(options().length).toBe(4 + 12 + 3);
  });

  it('filters commands by query', async () => {
    await openPalette();
    const input = fixture.nativeElement.querySelector('.palette-search input') as HTMLInputElement;
    input.value = 'metronome';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const remaining = options();
    expect(remaining.length).toBe(1);
    expect(remaining[0].textContent).toContain('Go to Metronome');
  });

  it('runs the highlighted navigation command on Enter', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await openPalette();

    const input = fixture.nativeElement.querySelector('.palette-search input') as HTMLInputElement;
    input.value = 'chords';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/chords']);
    expect(fixture.componentInstance.closed).toBe(true);
  });

  it('changes the root note from the palette', async () => {
    expect(preferences.state().rootPitchClass).toBe(4);

    await openPalette();

    const rootOption = options().find((option) => option.textContent?.includes('Root note: C'));
    if (!rootOption) throw new Error('Root note command not rendered');

    rootOption.click();
    fixture.detectChanges();

    expect(preferences.state().rootPitchClass).toBe(0);
    expect(fixture.componentInstance.closed).toBe(true);
  });

  it('toggles the theme from the palette', async () => {
    const before = themeService.theme();
    await openPalette();

    const toggleOption = options().find((option) => option.textContent?.includes('Toggle theme'));
    if (!toggleOption) throw new Error('Toggle theme command not rendered');

    toggleOption.click();
    fixture.detectChanges();

    expect(themeService.theme()).toBe(before === 'dark' ? 'light' : 'dark');
  });

  it('moves the active option with arrow keys', async () => {
    await openPalette();
    const input = fixture.nativeElement.querySelector('.palette-search input') as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1].id);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('emits dismiss when the dialog is cancelled', async () => {
    await openPalette();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { bubbles: false, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.closed).toBe(true);
  });

  it('has no axe violations while open', async () => {
    await openPalette();
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
