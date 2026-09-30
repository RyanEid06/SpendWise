import React, { useState } from 'react';
import { ChevronRight, EllipsisVertical, Image as ImageIcon, NotebookPen, Trash2 } from 'lucide-react';
import { Expense, Language } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName } from '../utils/translations';
import { formatHistoryTime, localeForLanguage } from '../utils/historyView';
import { ta } from '../utils/attachmentTranslations';
import { wp17Copy } from '../utils/wp17Copy';

interface ExpenseItemCardProps {
  expense: Expense;
  currencyCode: string;
  language: Language;
  attachmentCount: number;
  onClick: () => void;
  onDeleteClick: () => void;
  deleteLabel?: string;
}

export const ExpenseItemCard: React.FC<ExpenseItemCardProps> = ({
  expense,
  currencyCode,
  language,
  attachmentCount,
  onClick,
  onDeleteClick,
  deleteLabel,
}) => {
  const [showActions, setShowActions] = useState(false);
  const catInfo = getCategoryInfo(expense.category);
  const localizedCat = getLocalizedCategoryName(expense.category, language);
  const hasNote = Boolean(expense.note?.trim());
  const localizedDate = new Intl.DateTimeFormat(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
  }).format(new Date(expense.date));

  const openDetail = () => {
    if (!showActions) onClick();
  };

  return (
    <div
      className="relative bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setShowActions(false);
        }
      }}
    >
      <div
        onClick={openDetail}
        role="button"
        tabIndex={0}
        aria-label={`${expense.description}, ${formatCurrency(expense.amount, currencyCode)}, ${localizedCat}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
          }
        }}
        className="min-h-[64px] px-3 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 cursor-pointer active:scale-[0.995] transition-transform select-none"
      >
        <div
          style={{ backgroundColor: `${catInfo.color}15`, borderColor: `${catInfo.color}35` }}
          className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0"
          aria-hidden="true"
        >
          {catInfo.iconEmoji}
        </div>

        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate leading-snug">
            {expense.description}
          </h4>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span style={{ color: catInfo.color }} className="font-semibold shrink-0">
              {localizedCat}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="shrink-0 whitespace-nowrap">
              {localizedDate} · {formatHistoryTime(expense.date, language)}
            </span>
            {attachmentCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0"
                  title={attachmentCount === 1 ? ta(language, 'photoAttached') : ta(language, 'photosAttached', { count: attachmentCount })}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="font-bold">{attachmentCount}</span>
                </span>
              </>
            )}
            {hasNote && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0"
                  title={wp17Copy(language, 'noteAttached')}
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  <span className="sr-only">{wp17Copy(language, 'noteAttached')}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center min-w-0">
          <div className="min-w-0 text-right rtl:text-left">
            <div
              dir="ltr"
              className="max-w-[7rem] font-extrabold text-sm tabular-nums text-slate-900 dark:text-white [overflow-wrap:anywhere] leading-tight"
            >
              {formatCurrency(expense.amount, currencyCode)}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0 ml-1 rtl:ml-0 rtl:mr-1" aria-hidden="true" />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowActions((current) => !current);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="w-12 h-12 -my-2 -mr-2 rtl:-mr-0 rtl:-ml-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-haspopup="menu"
            aria-expanded={showActions}
            aria-label={language === 'fr' ? 'Actions de dépense' : language === 'ar' ? 'إجراءات المصروف' : 'Expense actions'}
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showActions && (
        <div
          role="menu"
          className="absolute z-20 right-2 rtl:right-auto rtl:left-2 top-[52px] min-w-[11rem] p-1.5 rounded-xl bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-700 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              setShowActions(false);
              onDeleteClick();
            }}
            className="w-full min-h-[48px] px-3 rounded-lg flex items-center gap-2 rtl:flex-row-reverse text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            aria-label={`${deleteLabel || wp17Copy(language, 'deleteAction')}: ${expense.description}`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{deleteLabel || wp17Copy(language, 'deleteAction')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
