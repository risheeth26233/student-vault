// Media Query Hook
// For responsive behavior

import { useMemo, useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const media = useMemo(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query) : null, [query]);
  const subscribe = useCallback((listener: () => void) => {
    media?.addEventListener('change', listener);
    return () => media?.removeEventListener('change', listener);
  }, [media]);
  return useSyncExternalStore(subscribe, () => media?.matches ?? false, () => false);
}

// Common breakpoint hooks
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLargeDesktop(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function useHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)');
}
