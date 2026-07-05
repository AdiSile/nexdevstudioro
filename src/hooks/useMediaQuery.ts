'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design that evaluates a CSS media query
 * and returns whether it currently matches.
 *
 * @param query - A valid CSS media query string (e.g. '(min-width: 768px)')
 * @param initialValue - Optional initial value to use during SSR/hydration. Defaults to `false`.
 * @returns `true` if the media query matches, `false` otherwise.
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 639px)');
 * const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 *
 */
export function useMediaQuery(query: string, initialValue = false): boolean {
  const [matches, setMatches] = useState<boolean>(initialValue);

  useEffect(() => {
    // Guard against SSR – matchMedia is only available in the browser
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Sync state with the current match status
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Subscribe to changes
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers (Safari < 14)
      mediaQueryList.addListener(handleChange);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}