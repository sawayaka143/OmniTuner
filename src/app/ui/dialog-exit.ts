import { signal, Signal } from '@angular/core';

// Matches the --dur-exit token used by the .closing exit animations, plus a
// safety buffer so dialogs always dismiss even when animationend never fires
// (e.g. the animation is disabled for reduced motion).
export const DIALOG_EXIT_FALLBACK_MS = 250;

export interface DialogExit {
  readonly closing: Signal<boolean>;
  begin: () => void;
  finish: () => void;
  ownsAnimation: (event: AnimationEvent) => boolean;
  destroy: () => void;
}

export function createDialogExit(view: Window | null, dismiss: () => void): DialogExit {
  const closing = signal(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = (): void => {
    if (timer !== null) {
      view?.clearTimeout(timer);
      timer = null;
    }
    if (!closing()) return;
    closing.set(false);
    dismiss();
  };

  return {
    closing,
    begin: (): void => {
      if (closing()) return;
      if (prefersReducedMotion(view)) {
        dismiss();
        return;
      }
      closing.set(true);
      timer = view?.setTimeout(finish, DIALOG_EXIT_FALLBACK_MS) ?? null;
    },
    finish,
    ownsAnimation: (event: AnimationEvent): boolean =>
      event.animationName === 'omni-dialog-out' || event.animationName === 'omni-sheet-down',
    destroy: (): void => {
      if (timer !== null) {
        view?.clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export function prefersReducedMotion(view: Window | null): boolean {
  try {
    return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}
