import { expect } from 'vitest';

import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js';

expect.extend({ toHaveNoViolations });

// jsdom does not implement <dialog>; polyfill it once so specs that assert on
// `dialog.open` are not at the mercy of whichever spec ran first.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement): void {
    this.open = false;
  };
}
