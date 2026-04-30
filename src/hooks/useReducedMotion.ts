// Honour the OS-level "reduce motion" accessibility preference.
//
// Used by:
//   - Combo tier flash (skip the bouncy entrance)
//   - Achievement toasts (just appear instead of slide-in)
//   - Marquee scroll speed reduction
//
// motion/react actually exports its own useReducedMotion(), but defining ours
// gives a stable export point if we want to wire in user opt-out later.

import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
