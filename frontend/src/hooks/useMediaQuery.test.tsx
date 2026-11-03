// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useReducedMotion } from './useMediaQuery';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('honors reduced motion on the first render and updates when the preference changes', () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: true,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const { result, unmount } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(true);
  act(() => { media.matches = false; listeners.forEach(listener => listener()); });
  expect(result.current).toBe(false);
  expect(media.addEventListener).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});
