// Augments vitest's Assertion with the axe matcher.
// vitest-axe@0.1 targets the legacy `Vi` namespace (vitest <=3); vitest 4
// declares matchers inside `@vitest/expect`, so we re-declare it here.
import 'vitest-axe/extend-expect';

declare module '@vitest/expect' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
