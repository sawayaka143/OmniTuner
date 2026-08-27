import { expect } from 'vitest';

import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';

expect.extend({ toHaveNoViolations });
