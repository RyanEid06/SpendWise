import React from 'react';
import { ViewportPortal } from './ViewportPortal';
import { Language } from '../types';

const COPY = {
  en: { single: 'Expense deleted', multiple: (count: number) => `${count} expenses deleted`, undo: 'Undo', failed: 'Deletion failed. Expense restored.', dismiss: 'Dismiss' },
  fr: { single: 'Dépense supprimée', multiple: (count: number) => `${count} dépenses supprimées`, undo: 'Annuler', failed: 'Échec de la suppression. Dépense restaurée.', dismiss: 'Fermer' },
  ar: { single: 'تم حذف المصروف', multiple: (count: number) => `تم حذف ${count} مصروفات`, undo: 'تراجع', failed: 'تعذر الحذف. تمت استعادة المصروف.', dismiss: 'إغلاق' },
} as const;

interface UndoSnackbarProps {
  count: number;
  language: Language;
  onUndo: () => void;
  hasBottomNavigation: boolean;
  hasFloatingAction: boolean;
  commitError?: boolean;
  onDismissError?: () => void;
}

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  count, language, onUndo, hasBottomNavigation, hasFloatingAction, commitError = false, onDismissError,
}) => {
  if (count <= 0 && !commitError) return null;
  const copy = COPY[language];
  const message = commitError ? copy.failed : count === 1 ? copy.single : copy.multiple(count);
  const bottom = hasFloatingAction
    ? 'calc(8.75rem + env(safe-area-inset-bottom, 0px))'
    : hasBottomNavigation
      ? 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'
      : 'calc(1rem + env(safe-area-inset-bottom, 0px))';

  return (
    <ViewportPortal>
      <div
        className="fixed left-1/2 z-[70] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-700/20 bg-slate-950/95 px-3.5 py-2.5 text-white shadow-2xl backdrop-blur-md dark:border-slate-600/40"
        style={{ bottom }}
        role={commitError ? 'alert' : 'status'}
        aria-live={commitError ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <span className="min-w-0 text-sm font-bold leading-snug">{message}</span>
          <button
            type="button"
            onClick={commitError ? onDismissError : onUndo}
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-extrabold text-emerald-300 hover:bg-white/10"
            aria-label={commitError ? copy.dismiss : copy.undo}
          >
            {commitError ? copy.dismiss : copy.undo}
          </button>
        </div>
      </div>
    </ViewportPortal>
  );
};
