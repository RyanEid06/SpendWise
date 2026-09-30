import React from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';

export interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  hint?: string;
  indicator: 'expand' | 'navigate' | 'none';
  expanded?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  hint,
  indicator,
  expanded = false,
  destructive = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={indicator === 'expand' ? expanded : undefined}
    className={
      'w-full min-h-[56px] px-3.5 py-2.5 flex items-center gap-3 text-left rtl:text-right transition-colors ' +
      (destructive
        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
        : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/40')
    }
  >
    <span className={
      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ' +
      (destructive
        ? 'bg-rose-100 dark:bg-rose-950/50'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
    }>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold leading-5">{label}</span>
      {hint && <span className="block text-[11px] leading-4 text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>}
    </span>
    {value && (
      <span className="max-w-[42%] text-xs text-slate-500 dark:text-slate-400 text-right rtl:text-left break-words">
        {value}
      </span>
    )}
    {indicator === 'expand' && (
      expanded
        ? <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
        : <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
    )}
    {indicator === 'navigate' && (
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden="true" />
    )}
  </button>
);
