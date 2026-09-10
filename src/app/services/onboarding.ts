import { InjectionToken, Service, inject, signal } from '@angular/core';

export const ONBOARDING_STORAGE_KEY = 'omnituner.onboarding.v1';

export const ONBOARDING_STORAGE = new InjectionToken<Storage | null>('Onboarding storage', {
  factory: () => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  },
});

@Service()
export class Onboarding {
  private readonly storage = inject(ONBOARDING_STORAGE);
  private readonly dismissedSignal = signal<ReadonlySet<string>>(this.load());

  readonly dismissed = this.dismissedSignal.asReadonly();

  dismiss(step: string): void {
    if (this.dismissedSignal().has(step)) return;
    const next = new Set(this.dismissedSignal());
    next.add(step);
    this.dismissedSignal.set(next);
    this.persist(next);
  }

  private load(): ReadonlySet<string> {
    if (!this.storage) return new Set();
    try {
      const raw = this.storage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((step): step is string => typeof step === 'string'));
    } catch {
      return new Set();
    }
  }

  private persist(dismissed: ReadonlySet<string>): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify([...dismissed]));
    } catch {}
  }
}
