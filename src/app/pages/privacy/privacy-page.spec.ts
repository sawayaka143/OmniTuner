import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { axe } from 'vitest-axe';

import { PrivacyPage } from './privacy-page';

describe('PrivacyPage', () => {
  let fixture: ComponentFixture<PrivacyPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('states that audio never leaves the device and lists the storage keys', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('never leaves your device');
    expect(text).toContain('omnituner.tuner-preferences.v1');
    expect(text).toContain('omnituner.instruments.v1');
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
