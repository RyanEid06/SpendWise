import React from 'react';
import { ChevronRight, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Expense, Language } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { formatShortDate } from '../utils/date';
import { getLocalizedCategoryName, t } from '../utils/translations';
import { AttachmentStorage } from '../utils/attachmentStorage';
import { ta } from '../utils/attachmentTranslations';

interface ExpenseItemCardProps {
  expense: Expense;
  currencyCode: string;
  language: Language;
  onClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}

export const ExpenseItemCard: React.FC<ExpenseItemCardProps> = ({
  expense,
  currencyCode,
  language,
  onClick,
  onDeleteClick,
}) => {
  const catInfo = getCategoryInfo(expense.category);
  const localizedCat = getLocalizedCategoryName(expense.category, language);
  const attachmentCount = AttachmentStorage.getAttachmentsForExpense(expense.id).length;

  const openDetail = () => onClick();

  return (
    <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
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
        className="p-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 cursor-pointer group active:scale-[0.995] transition-all select-none"
      >
        <div
          style={{ backgroundColor: `${catInfo.color}15`, borderColor: `${catInfo.color}35` }}
          className="w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0"
          aria-hidden="true"
        >
          {catInfo.iconEmoji}
        </div>

        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate leading-snug">
            {expense.description}
          </h4>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs mt-1 text-slate-500 dark:text-slate-400">
            <span
              style={{ color: catInfo.color }}
              className="font-semibold text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 shrink-0"
            >
              {localizedCat}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="shrink-0 whitespace-nowrap">{formatShortDate(expense.date)}</span>
            {attachmentCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0"
                  title={
                    attachmentCount === 1
                      ? ta(language, 'photoAttached')
                      : ta(language, 'photosAttached', { count: attachmentCount })
                  }
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">{attachmentCount}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="min-w-0 text-right rtl:text-left">
            <div
              dir="ltr"
              className="max-w-[7.5rem] font-extrabold text-sm sm:text-base tabular-nums text-slate-900 dark:text-white [overflow-wrap:anywhere] leading-tight"
            >
              {formatCurrency(expense.amount, currencyCode)}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" aria-hidden="true" />
        </div>
      </div>

      <div className="px-3.5 pb-3 flex justify-end border-t border-slate-100 dark:border-slate-800/70 pt-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteClick(event);
          }}
          className="min-h-[40px] px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold inline-flex items-center gap-1.5"
          aria-label={`${t(language, 'deleteExpenseBtnLabel')}: ${expense.description}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t(language, 'deleteExpenseBtnLabel')}
        </button>
      </div>
    </div>
  );
};
