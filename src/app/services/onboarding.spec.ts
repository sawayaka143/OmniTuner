import { TestBed } from '@angular/core/testing';

import { ONBOARDING_STORAGE, ONBOARDING_STORAGE_KEY, Onboarding } from './onboarding';

class FakeStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('Onboarding', () => {
  let storage: FakeStorage;

  const create = (): Onboarding => {
    TestBed.configureTestingModule({
      providers: [{ provide: ONBOARDING_STORAGE, useValue: storage }],
    });
    return TestBed.inject(Onboarding);
  };

  beforeEach(() => {
    storage = new FakeStorage();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('starts with nothing dismissed', () => {
    expect(create().dismissed().size).toBe(0);
  });

  it('records a dismissed step and persists it', () => {
    const service = create();
    service.dismiss('tuner-intro');

    expect(service.dismissed().has('tuner-intro')).toBe(true);
    expect(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY) as string)).toEqual(['tuner-intro']);
  });

  it('reads a previously dismissed step back from storage', () => {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(['tuner-intro']));

    expect(create().dismissed().has('tuner-intro')).toBe(true);
  });

  it('ignores corrupt stored values', () => {
    storage.setItem(ONBOARDING_STORAGE_KEY, 'not json at all');

    expect(create().dismissed().size).toBe(0);
  });

  it('is a no-op when the same step is dismissed twice', () => {
    const service = create();
    service.dismiss('tuner-intro');
    const first = service.dismissed();
    service.dismiss('tuner-intro');

    expect(service.dismissed()).toBe(first);
  });
});
