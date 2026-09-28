import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Trash2, Calendar, FileText, Image as ImageIcon, Tag } from 'lucide-react';
import { Expense, Language } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { formatDate, formatShortDate } from '../utils/date';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const catInfo = getCategoryInfo(expense.category);
  const localizedCat = getLocalizedCategoryName(expense.category, language);
  const attachmentCount = AttachmentStorage.getAttachmentsForExpense(expense.id).length;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className={`bg-white dark:bg-[#111928] border rounded-2xl transition-all shadow-xs overflow-hidden ${
        isExpanded
          ? 'border-emerald-500/50 dark:border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-md'
          : 'border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Main Collapsed Row */}
      <div
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${expense.description}, ${formatCurrency(expense.amount, currencyCode)}, ${localizedCat}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.995] transition-all select-none"
      >
        {/* Left: Category Icon */}
        <div
          style={{ backgroundColor: `${catInfo.color}15`, borderColor: `${catInfo.color}35` }}
          className="w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105"
          aria-hidden="true"
        >
          {catInfo.iconEmoji}
        </div>

        {/* Middle: Mini Description and Category + Date */}
        <div className="flex-1 min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
          {/* Mini Description (Truncated) */}
          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate leading-snug">
            {expense.description}
          </h4>

          {/* Category & Date on their own dedicated line to prevent ANY overlapping */}
          <div className="flex items-center gap-1.5 text-xs mt-1 text-slate-500 dark:text-slate-400">
            <span
              style={{ color: catInfo.color }}
              className="font-semibold text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 shrink-0"
            >
              {localizedCat}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400 text-xs shrink-0 whitespace-nowrap">
              {formatShortDate(expense.date)}
            </span>
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
                  <span className="sr-only">
                    {attachmentCount === 1
                      ? ta(language, 'photoAttached')
                      : ta(language, 'photosAttached', { count: attachmentCount })}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Amount & Little Arrow (Chevron) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right rtl:text-left">
            <div className="font-extrabold text-sm sm:text-base tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(expense.amount, currencyCode)}
            </div>
          </div>

          {/* Little Arrow Toggle Button */}
          <button
            type="button"
            onClick={toggleExpand}
            className={`min-w-[36px] min-h-[36px] w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isExpanded
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            aria-label={isExpanded ? t(language, 'collapseDetailsLabel') : t(language, 'expandDetailsLabel')}
            title={isExpanded ? t(language, 'collapseDetailsLabel') : t(language, 'expandDetailsLabel')}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 transition-transform" />
            ) : (
              <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Full Details Section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 space-y-3 animate-fadeIn">
          {/* Full Description */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t(language, 'fullDescriptionLabel')}</span>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white break-words leading-relaxed pl-5 rtl:pl-0 rtl:pr-5">
              {expense.description}
            </p>
          </div>

          {/* Notes & Breakdown (if present) */}
          {expense.note && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#111928] border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t(language, 'notesLabel')}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 break-words leading-relaxed whitespace-pre-wrap pl-5 rtl:pl-0 rtl:pr-5">
                {expense.note}
              </p>
            </div>
          )}

          {attachmentCount > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                {attachmentCount === 1
                  ? ta(language, 'photoAttached')
                  : ta(language, 'photosAttached', { count: attachmentCount })}
              </span>
              <span>{ta(language, 'viewPhotos')}</span>
            </button>
          )}

          {/* Full Date & Timestamp */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatDate(expense.date)}</span>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t(language, 'editExpenseBtnLabel')}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(e);
              }}
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t(language, 'deleteExpenseBtnLabel')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
