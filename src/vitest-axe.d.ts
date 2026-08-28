import 'vitest-axe/extend-expect';

declare module '@vitest/expect' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}
