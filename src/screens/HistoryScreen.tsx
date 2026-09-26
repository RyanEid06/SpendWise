import React, { useState, useMemo } from 'react';
import { Search, X, ReceiptText, Plus } from 'lucide-react';
import { Expense } from '../types';
import { MonthYear, getDisplayName } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { MonthSelector } from '../components/MonthSelector';
import { ExpenseItemCard } from '../components/ExpenseItemCard';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface HistoryScreenProps {
  currentMonthYear: MonthYear;
  expenses: Expense[];
  currencyCode: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onExpenseClick: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onAddExpenseClick: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  currentMonthYear,
  expenses,
  currencyCode,
  onPreviousMonth,
  onNextMonth,
  onExpenseClick,
  onDeleteExpense,
  onAddExpenseClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q))
    );
  }, [expenses, searchQuery]);

  const totalSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div className="space-y-4 pb-28">
      {/* Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* Search Input & Counter Header */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search description, category, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-slate-800 bg-[#111928] text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-slate-400 font-medium">
          <span>
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
          </span>
          <span className="font-extrabold text-emerald-400 text-sm">
            Total: {formatCurrency(totalSpent, currencyCode)}
          </span>
        </div>
      </div>

      {/* Expense List or Empty State */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-8 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-850 text-slate-500 flex items-center justify-center mx-auto">
            <ReceiptText className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-white text-base">
            {searchQuery
              ? 'No matching expenses found'
              : `No expenses in ${getDisplayName(currentMonthYear)}`}
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {searchQuery
              ? 'Try clearing your search query to see all month transactions.'
              : 'Record your spending to keep your budget on track.'}
          </p>
          {!searchQuery && (
            <button
              onClick={onAddExpenseClick}
              className="inline-flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map((expense) => (
            <ExpenseItemCard
              key={expense.id}
              expense={expense}
              currencyCode={currencyCode}
              onClick={() => onExpenseClick(expense)}
              onDeleteClick={() => setExpenseToDelete(expense)}
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Deleting */}
      <ConfirmationModal
        isOpen={expenseToDelete !== null}
        title="Delete Expense?"
        message={`Are you sure you want to delete "${expenseToDelete?.description}" (${
          expenseToDelete ? formatCurrency(expenseToDelete.amount, currencyCode) : ''
        })? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onConfirm={() => {
          if (expenseToDelete) {
            onDeleteExpense(expenseToDelete);
            setExpenseToDelete(null);
          }
        }}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
};
