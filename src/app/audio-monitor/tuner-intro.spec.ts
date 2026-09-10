import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe } from 'vitest-axe';

import { ONBOARDING_STORAGE, ONBOARDING_STORAGE_KEY, Onboarding } from '../services/onboarding';
import { TunerIntro } from './tuner-intro';

class FakeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('TunerIntro', () => {
  let fixture: ComponentFixture<TunerIntro>;
  let storage: FakeStorage;

  beforeEach(async () => {
    storage = new FakeStorage();
    await TestBed.configureTestingModule({
      imports: [TunerIntro],
      providers: [{ provide: ONBOARDING_STORAGE, useValue: storage }],
    }).compileComponents();

    fixture = TestBed.createComponent(TunerIntro);
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('explains the microphone prompt and how to start', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('First time here?');
    expect(text).toContain('microphone access');
    expect(text).toContain('never recorded or uploaded');
  });

  it('hides itself once dismissed and remembers the dismissal', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.intro-card')).toBeNull();
    expect(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY) as string)).toEqual(['tuner-intro']);
  });

  it('stays hidden for a returning user who dismissed it before', async () => {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(['tuner-intro']));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TunerIntro],
      providers: [{ provide: ONBOARDING_STORAGE, useValue: storage }],
    }).compileComponents();

    const refreshed = TestBed.createComponent(TunerIntro);
    refreshed.detectChanges();

    expect(refreshed.nativeElement.querySelector('.intro-card')).toBeNull();
    refreshed.destroy();
  });

  it('has no axe violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  it('is backed by a single onboarding service instance', () => {
    expect(TestBed.inject(Onboarding)).toBeTruthy();
  });
});
