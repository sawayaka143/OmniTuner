import 'vitest-axe/extend-expect';

declare module '@vitest/expect' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}

declare module '*.scss?raw' {
  const content: string;
  export default content;
}
