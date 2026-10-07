import { useLayoutEffect, useRef } from 'react';
import type { Screen } from '../../types';

/** Scroll belongs to each tab; ordinary navigation does not reset reading position. */
export function useTabScroll(screen: Screen) {
  const positions = useRef<Partial<Record<Screen, number>>>({});
  useLayoutEffect(() => {
    window.scrollTo(0, positions.current[screen] ?? 0);
    const remember = () => { positions.current[screen] = window.scrollY; };
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [screen]);
}
