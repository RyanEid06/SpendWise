import { useLayoutEffect, useState } from 'react';

/** Android IME may shrink only the visual viewport, rather than CSS vh. */
export function useVisualViewport() {
  const measure = () => ({ height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0 });
  const [viewport, setViewport] = useState(measure);
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      setViewport(measure());
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.matches('input, textarea, select')) {
          focused.scrollIntoView({ block: 'nearest' });
        }
      });
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}
