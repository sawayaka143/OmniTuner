import { describe, expect, it, vi } from 'vitest';

import { createDialogExit, prefersReducedMotion } from './dialog-exit';

const animationEvent = (name: string): AnimationEvent =>
  ({ animationName: name }) as AnimationEvent;

describe('createDialogExit', () => {
  it('starts closing and dismisses after the fallback timeout', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const exit = createDialogExit(window, dismiss);

    exit.begin();
    expect(exit.closing()).toBe(true);
    expect(dismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(exit.closing()).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(1);

    exit.destroy();
    vi.useRealTimers();
  });

  it('dismisses as soon as the exit animation ends', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const exit = createDialogExit(window, dismiss);

    exit.begin();
    exit.finish();
    expect(exit.closing()).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(dismiss).toHaveBeenCalledTimes(1);

    exit.destroy();
    vi.useRealTimers();
  });

  it('ignores begin while a close is already in flight', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const exit = createDialogExit(window, dismiss);

    exit.begin();
    exit.begin();
    vi.advanceTimersByTime(250);
    expect(dismiss).toHaveBeenCalledTimes(1);

    exit.destroy();
    vi.useRealTimers();
  });

  it('survives destroy while closing without dismissing', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const exit = createDialogExit(window, dismiss);

    exit.begin();
    exit.destroy();
    vi.advanceTimersByTime(500);
    expect(dismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('recognizes only the shared dialog exit animations', () => {
    const exit = createDialogExit(window, vi.fn());
    expect(exit.ownsAnimation(animationEvent('dropdown-appear'))).toBe(false);
    expect(exit.ownsAnimation(animationEvent('omni-dialog-out'))).toBe(true);
    expect(exit.ownsAnimation(animationEvent('omni-sheet-down'))).toBe(true);
    exit.destroy();
  });

  it('dismisses immediately under prefers-reduced-motion', () => {
    const reducedView = {
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;
    const dismiss = vi.fn();
    const exit = createDialogExit(reducedView, dismiss);

    exit.begin();
    expect(exit.closing()).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(1);

    exit.destroy();
  });
});

describe('prefersReducedMotion', () => {
  it('returns false when the media query does not match', () => {
    const view = {
      matchMedia: () => ({ matches: false }),
    } as unknown as Window;
    expect(prefersReducedMotion(view)).toBe(false);
  });

  it('returns false without a view', () => {
    expect(prefersReducedMotion(null)).toBe(false);
  });
});
