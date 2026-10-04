import React, { useEffect, useRef } from 'react';
import { ViewportPortal } from './ViewportPortal';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => onCancel();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    window.addEventListener('spendwise-native-back', close);
    document.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('spendwise-native-back', close);
      document.removeEventListener('keydown', key);
      previousFocus?.focus();
    };
  }, [isOpen, onCancel]);
  if (!isOpen) return null;
  return (<ViewportPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="alertdialog"
      data-native-back-layer="true"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      ref={dialogRef}
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 space-y-4 transition-colors">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <h3 id="confirm-modal-title" className="font-bold text-lg text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>

        <p id="confirm-modal-desc" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
      </div></ViewportPortal>
  );
};
