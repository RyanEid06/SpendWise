import { useLayoutEffect, useRef } from 'react';

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep keyboard focus in a backup dialog and return it when the dialog closes. */
export function useModalFocus(initialSelector = focusableSelector, open = true) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body && !dialog.contains(document.activeElement)
      ? document.activeElement : null;

    (dialog.querySelector<HTMLElement>(initialSelector) ?? dialog).focus({ preventScroll: true });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (!dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      // Native taps do not always focus the trigger. A stable main landmark is
      // the fallback, rather than leaving focus on body after removing a dialog.
      const target = previous?.isConnected ? previous : document.getElementById('main-content');
      target?.focus({ preventScroll: true });
    };
  }, [initialSelector, open]);

  return dialogRef;
}
