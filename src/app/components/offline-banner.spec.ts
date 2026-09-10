import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { OfflineBanner } from './offline-banner';

const setOnline = (value: boolean): void => {
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value });
};

describe('OfflineBanner', () => {
  let fixture: ComponentFixture<OfflineBanner>;

  const create = async (): Promise<void> => {
    await TestBed.configureTestingModule({ imports: [OfflineBanner] }).compileComponents();
    fixture = TestBed.createComponent(OfflineBanner);
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('stays hidden while online', async () => {
    setOnline(true);
    await create();

    expect(fixture.nativeElement.querySelector('.offline-banner')).toBeNull();
  });

  it('shows when the window reports it is offline', async () => {
    setOnline(true);
    await create();

    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.offline-banner')).not.toBeNull();
  });

  it('hides again once connectivity returns', async () => {
    setOnline(false);
    await create();
    expect(fixture.nativeElement.querySelector('.offline-banner')).not.toBeNull();

    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.offline-banner')).toBeNull();
  });

  it('announces the state politely and has no axe violations', async () => {
    setOnline(false);
    await create();

    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
