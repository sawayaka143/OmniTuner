// Loads vitest-axe's global Assertion augmentation (toHaveNoViolations).
// The package ships no exports map, so `types: ["vitest-axe/extend-expect"]`
// does not resolve — importing the d.ts here pulls it into the program.
import 'vitest-axe/extend-expect';

declare module '@vitest/expect' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}

// Raw-text import used by the token contrast guard.
declare module '*.scss?raw' {
  const content: string;
  export default content;
}
