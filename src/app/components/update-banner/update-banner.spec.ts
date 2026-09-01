import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { AppUpdateService } from '../../services/app-update.service';
import { UpdateBanner } from './update-banner';

describe('UpdateBanner', () => {
  let fixture: ComponentFixture<UpdateBanner>;
  let updateAvailable: ReturnType<typeof signal<boolean>>;
  let applyUpdate: ReturnType<typeof vi.fn>;

  const banner = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('.update-banner');

  beforeEach(() => {
    updateAvailable = signal(false);
    applyUpdate = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: AppUpdateService, useValue: { updateAvailable, applyUpdate } }],
    });
    fixture = TestBed.createComponent(UpdateBanner);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders nothing until an update is available', () => {
    expect(banner()).toBeNull();
  });

  it('shows the banner with a live region and reload action once an update is ready', () => {
    updateAvailable.set(true);
    fixture.detectChanges();

    const element = banner();
    expect(element).not.toBeNull();
    expect(element?.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'New version available',
    );
    const reload = (element as HTMLElement).querySelector<HTMLButtonElement>('button.reload');
    expect(reload?.textContent?.trim()).toBe('Reload');
  });

  it('reloads the app when the reload button is pressed', () => {
    updateAvailable.set(true);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.reload')!
      .click();

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('hides the banner when dismissed', () => {
    updateAvailable.set(true);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.actions app-icon-button button')
      ?.click();
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it('keeps the banner hidden after dismissal even while an update is still pending', () => {
    updateAvailable.set(true);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.actions app-icon-button button')
      ?.click();
    fixture.detectChanges();

    updateAvailable.set(true);
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it('has no axe violations while visible', async () => {
    updateAvailable.set(true);
    fixture.detectChanges();

    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
