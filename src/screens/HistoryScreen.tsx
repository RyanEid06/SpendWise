import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ReceiptText, Search, X } from 'lucide-react';
import { Expense, Language } from '../types';
import { MonthYear } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { MonthSelector } from '../components/MonthSelector';
import { SwipeableExpenseCard } from '../components/SwipeableExpenseCard';
import { getLocalizedCategoryName, getLocalizedMonthName, t } from '../utils/translations';
import { getCategoryInfo } from '../utils/categories';
import { AttachmentStorage } from '../utils/attachmentStorage';
import {
  dateFromInputValue,
  dateInputValue,
  filterHistoryByDay,
  formatHistoryGroupLabel,
  groupHistoryByCategory,
  groupHistoryByDay,
  HistoryViewMode,
  searchHistoryExpenses,
  shiftLocalDay,
} from '../utils/historyView';
import { wp17Copy } from '../utils/wp17Copy';

interface HistoryScreenProps {
  currentMonthYear: MonthYear;
  expenses: Expense[];
  currencyCode: string;
  language: Language;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onExpenseClick: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void | Promise<void>;
  onAddExpenseClick: () => void;
}

function defaultSelectedDay(expenses: Expense[], currentMonthYear: MonthYear): number {
  if (expenses.length > 0) {
    return searchHistoryExpenses(expenses, '')[0].date;
  }
  return new Date(currentMonthYear.year, currentMonthYear.month - 1, 1, 12, 0, 0, 0).getTime();
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  currentMonthYear,
  expenses,
  currencyCode,
  language,
  onPreviousMonth,
  onNextMonth,
  onExpenseClick,
  onDeleteExpense,
  onAddExpenseClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<HistoryViewMode>('ALL');
  const [selectedDay, setSelectedDay] = useState(() => defaultSelectedDay(expenses, currentMonthYear));
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(defaultSelectedDay(expenses, currentMonthYear));
    setExpandedCategory(null);
  }, [currentMonthYear.year, currentMonthYear.month]);

  const attachmentCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const attachment of AttachmentStorage.getAllAttachments()) {
      counts.set(attachment.expenseId, (counts.get(attachment.expenseId) || 0) + 1);
    }
    return counts;
  }, [expenses]);

  const searchedExpenses = useMemo(
    () => searchHistoryExpenses(expenses, searchQuery),
    [expenses, searchQuery]
  );

  const dayExpenses = useMemo(
    () => filterHistoryByDay(searchedExpenses, selectedDay),
    [searchedExpenses, selectedDay]
  );

  const dateGroups = useMemo(
    () => groupHistoryByDay(searchedExpenses),
    [searchedExpenses]
  );

  const categoryGroups = useMemo(
    () => groupHistoryByCategory(searchedExpenses),
    [searchedExpenses]
  );

  const visibleExpenses = viewMode === 'DAY' ? dayExpenses : searchedExpenses;
  const totalSpent = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses]
  );

  const monthName = getLocalizedMonthName(currentMonthYear, language);
  const monthStart = new Date(currentMonthYear.year, currentMonthYear.month - 1, 1, 12, 0, 0, 0).getTime();
  const monthEnd = new Date(currentMonthYear.year, currentMonthYear.month, 0, 12, 0, 0, 0).getTime();
  const previousDay = shiftLocalDay(selectedDay, -1);
  const nextDay = shiftLocalDay(selectedDay, 1);

  const renderExpense = (expense: Expense) => (
    <SwipeableExpenseCard
      key={expense.id}
      expense={expense}
      currencyCode={currencyCode}
      language={language}
      attachmentCount={attachmentCounts.get(expense.id) || 0}
      onOpen={() => onExpenseClick(expense)}
      onRequestDelete={() => onDeleteExpense(expense)}
    />
  );

  const switchMode = (mode: HistoryViewMode) => {
    setViewMode(mode);
    if (mode === 'CATEGORY') setExpandedCategory(null);
  };

  return (
    <div className="space-y-4 pb-28 animate-screen-enter">
      <MonthSelector
        currentMonthYear={currentMonthYear}
        language={language}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80"
        role="tablist"
        aria-label={wp17Copy(language, 'historyView')}
      >
        {([
          ['ALL', wp17Copy(language, 'all')],
          ['DAY', wp17Copy(language, 'day')],
          ['CATEGORY', wp17Copy(language, 'category')],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={viewMode === mode}
            onClick={() => switchMode(mode)}
            className={`min-h-[48px] rounded-xl px-2 text-xs font-bold transition-colors ${
              viewMode === mode
                ? 'bg-white dark:bg-[#111928] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === 'DAY' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={previousDay < monthStart}
            onClick={() => setSelectedDay(previousDay)}
            className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] flex items-center justify-center disabled:opacity-35"
            aria-label={wp17Copy(language, 'previousDay')}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <label className="flex-1 min-w-0">
            <span className="sr-only">{wp17Copy(language, 'chooseDay')}</span>
            <input
              type="date"
              min={dateInputValue(monthStart)}
              max={dateInputValue(monthEnd)}
              value={dateInputValue(selectedDay)}
              onChange={(event) => {
                const value = dateFromInputValue(event.target.value);
                if (value != null && value >= monthStart && value <= monthEnd) setSelectedDay(value);
              }}
              className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] px-3 text-sm font-semibold text-slate-900 dark:text-white"
            />
          </label>
          <button
            type="button"
            disabled={nextDay > monthEnd}
            onClick={() => setSelectedDay(nextDay)}
            className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] flex items-center justify-center disabled:opacity-35"
            aria-label={wp17Copy(language, 'nextDay')}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3.5 rtl:pl-0 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            placeholder={t(language, 'searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full min-h-[48px] pl-9 pr-11 rtl:pl-11 rtl:pr-9 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111928] text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label={t(language, 'clearSearch')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>
            {visibleExpenses.length} {visibleExpenses.length === 1 ? t(language, 'expenseSingle') : t(language, 'expensePlural')}
          </span>
          <span dir="ltr" className="min-w-0 font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 text-sm [overflow-wrap:anywhere]">
            {t(language, 'total')} {formatCurrency(totalSpent, currencyCode)}
          </span>
        </div>
      </div>

      {visibleExpenses.length === 0 ? (
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
            <ReceiptText className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base">
            {searchQuery ? t(language, 'noMatchingTitle') : t(language, 'historyEmptyTitle', { month: monthName })}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {searchQuery ? t(language, 'noMatchingSub', { query: searchQuery }) : t(language, 'historyEmptySub')}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-[48px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs"
            >
              {t(language, 'clearSearch')}
            </button>
          )}
          {!searchQuery && viewMode !== 'DAY' && (
            <button
              type="button"
              onClick={onAddExpenseClick}
              className="min-h-[48px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs"
            >
              {t(language, 'addExpenseBtn')}
            </button>
          )}
        </div>
      ) : viewMode === 'ALL' ? (
        <div className="space-y-4">
          {dateGroups.map((group) => (
            <section key={group.key} className="space-y-2" aria-label={formatHistoryGroupLabel(group.dayTimestamp, language)}>
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {formatHistoryGroupLabel(group.dayTimestamp, language)}
                </span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
              </div>
              <div className="space-y-2">{group.expenses.map(renderExpense)}</div>
            </section>
          ))}
        </div>
      ) : viewMode === 'DAY' ? (
        <div className="space-y-2">{dayExpenses.map(renderExpense)}</div>
      ) : (
        <div className="space-y-2.5">
          {categoryGroups.map((group) => {
            const expanded = expandedCategory === group.category;
            const info = getCategoryInfo(group.category);
            return (
              <section key={group.category} className="rounded-2xl bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 overflow-hidden">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedCategory(expanded ? null : group.category)}
                  className="w-full min-h-[56px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left rtl:text-right"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0" aria-hidden="true">{info.iconEmoji}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {getLocalizedCategoryName(group.category, language)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {wp17Copy(language, 'expensesCount', { count: group.count })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span dir="ltr" className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(group.total, currencyCode)}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expanded && (
                  <div className="p-2.5 pt-0 space-y-2 border-t border-slate-100 dark:border-slate-800/70">
                    {group.expenses.map(renderExpense)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

    </div>
  );
};
