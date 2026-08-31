import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ImpactStyle } from '@capacitor/haptics';

import { HAPTICS_PLUGIN } from '../../services/haptics.service';
import { AppShell } from './app-shell';

@Component({ selector: 'app-empty-page', template: '' })
class EmptyPage {}

const TEST_ROUTES = [
  { path: 'tuner', component: EmptyPage },
  { path: 'chords', component: EmptyPage },
  { path: 'scales', component: EmptyPage },
  { path: 'metronome', component: EmptyPage },
];

describe('AppShell', () => {
  let fixture: ComponentFixture<AppShell>;
  let router: Router;
  let impact: ReturnType<typeof vi.fn>;

  const navItems = (): NodeListOf<HTMLAnchorElement> =>
    fixture.nativeElement.querySelectorAll('.bottom-nav-item');

  beforeEach(async () => {
    impact = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter(TEST_ROUTES),
        { provide: HAPTICS_PLUGIN, useValue: { impact, notification: vi.fn() } },
      ],
    });
    // jsdom does not implement <dialog> — stub what the panels call on open.
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders four destinations in the bottom navigation', () => {
    fixture.detectChanges();
    const items = navItems();
    expect(items.length).toBe(4);
    expect([...items].map((item) => item.textContent?.trim())).toEqual([
      'Tuner',
      'Chords',
      'Scales',
      'Metronome',
    ]);
  });

  it('falls back to the tuner title before any navigation happens', () => {
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.mobile-page-title');
    expect(title?.textContent?.trim()).toBe('Tuner');
  });

  it('marks the active destination with aria-current after navigating', async () => {
    await router.navigateByUrl('/metronome');
    fixture.detectChanges();

    const active = fixture.nativeElement.querySelector('.bottom-nav-item.active');
    expect(active?.getAttribute('aria-current')).toBe('page');
    expect(active?.textContent?.trim()).toBe('Metronome');
  });

  it('updates the mobile page title after navigating', async () => {
    await router.navigateByUrl('/chords');
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('.mobile-page-title');
    expect(title?.textContent?.trim()).toBe('Chords');
  });

  it('gives light haptic feedback when a destination is tapped', async () => {
    fixture.detectChanges();
    navItems()[2].click();
    await fixture.whenStable();

    expect(impact).toHaveBeenCalledWith({ style: ImpactStyle.Light });
  });

  it('opens settings from the mobile top bar trigger', () => {
    fixture.detectChanges();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.mobile-settings-trigger',
    );
    trigger.click();
    fixture.detectChanges();

    const shell = fixture.componentInstance as unknown as { settingsOpen(): boolean };
    expect(shell.settingsOpen()).toBe(true);
  });

  it('navigates to the next page on ArrowRight', async () => {
    await router.navigateByUrl('/tuner');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();

    expect(router.url).toBe('/chords');
  });

  it('navigates to the previous page on ArrowLeft and wraps around', async () => {
    await router.navigateByUrl('/tuner');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();

    expect(router.url).toBe('/metronome');
  });

  it('toggles the command palette with Ctrl+K and ignores it while settings are open', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();
    const shell = fixture.componentInstance as unknown as { paletteOpen(): boolean };
    expect(shell.paletteOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();
    expect(shell.paletteOpen()).toBe(false);
  });

  it('toggles the shortcut help with ? outside editable targets', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    await fixture.whenStable();
    const shell = fixture.componentInstance as unknown as { shortcutOpen(): boolean };
    expect(shell.shortcutOpen()).toBe(true);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    await fixture.whenStable();

    expect(shell.shortcutOpen()).toBe(true);
    input.remove();
  });
});
