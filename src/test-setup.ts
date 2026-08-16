import { expect } from 'vitest';
// The package's .d.ts re-exports the matcher as a type only, but the runtime
// value lives in the JS bundle — import the implementation directly.
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';

expect.extend({ toHaveNoViolations });
