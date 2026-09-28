import React, { useState, useMemo } from 'react';
import { Search, X, ReceiptText, Plus } from 'lucide-react';
import { Expense, Language } from '../types';
import { MonthYear } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { MonthSelector } from '../components/MonthSelector';
import { ExpenseItemCard } from '../components/ExpenseItemCard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { getLocalizedMonthName, t } from '../utils/translations';
import { ta } from '../utils/attachmentTranslations';

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
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q))
    );
  }, [expenses, searchQuery]);

  const totalSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const monthName = getLocalizedMonthName(currentMonthYear, language);

  return (
    <div className="space-y-4 pb-28 animate-screen-enter">
      {/* Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        language={language}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* Search Input & Counter Header */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3.5 rtl:pl-0 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder={t(language, 'searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-11 rtl:pl-11 rtl:pr-9 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111928] text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 pr-2 rtl:pr-0 rtl:pl-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              aria-label={t(language, 'clearSearch')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>
            {filteredExpenses.length} {filteredExpenses.length === 1 ? t(language, 'expenseSingle') : t(language, 'expensePlural')}
          </span>
          <span className="font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 text-sm">
            {t(language, 'total')} {formatCurrency(totalSpent, currencyCode)}
          </span>
        </div>
      </div>

      {/* Expense List or Empty State */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
            <ReceiptText className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base">
            {searchQuery
              ? t(language, 'noMatchingTitle')
              : t(language, 'historyEmptyTitle', { month: monthName })}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {searchQuery
              ? t(language, 'noMatchingSub', { query: searchQuery })
              : t(language, 'historyEmptySub')}
          </p>
          <div className="pt-2">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="min-h-[44px] inline-flex items-center space-x-1.5 rtl:space-x-reverse bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
              >
                <span>{t(language, 'clearSearch')}</span>
              </button>
            ) : (
              <button
                onClick={onAddExpenseClick}
                className="min-h-[44px] inline-flex items-center space-x-1.5 rtl:space-x-reverse bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{t(language, 'addExpenseBtn')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map((expense) => (
            <ExpenseItemCard
              key={expense.id}
              expense={expense}
              currencyCode={currencyCode}
              language={language}
              onClick={() => onExpenseClick(expense)}
              onDeleteClick={() => setExpenseToDelete(expense)}
            />
          ))}
        </div>
      )}

      {deleteError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
          {ta(language, 'expenseDeleteError')}
        </div>
      )}

      {/* Confirmation Dialog for Deleting */}
      <ConfirmationModal
        isOpen={expenseToDelete !== null}
        title={t(language, 'deleteExpenseTitle')}
        message={t(language, 'deleteExpenseMessage', {
          description: expenseToDelete?.description || '',
          amount: expenseToDelete ? formatCurrency(expenseToDelete.amount, currencyCode) : '',
        })}
        confirmText={t(language, 'deleteBtn')}
        cancelText={t(language, 'cancelBtn')}
        isDestructive={true}
        onConfirm={() => {
          if (!expenseToDelete) return;
          const target = expenseToDelete;
          setExpenseToDelete(null);
          setDeleteError(null);
          void Promise.resolve(onDeleteExpense(target)).catch(() => {
            setDeleteError(ta(language, 'expenseDeleteError'));
          });
        }}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
};
