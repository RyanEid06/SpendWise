import { useCallback, useState } from 'react';
import { Expense } from '../../types';

export function useAppOverlays() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const openAddExpense = useCallback(() => {
    setEditingExpense(null);
    setShowAddModal(true);
  }, []);

  const openEditExpense = useCallback((expense: Expense) => {
    setShowAddModal(false);
    setEditingExpense(expense);
  }, []);

  const closeExpenseEditor = useCallback(() => {
    setShowAddModal(false);
    setEditingExpense(null);
  }, []);

  const openExpenseDetail = useCallback((expense: Expense) => {
    setViewingExpense(expense);
  }, []);

  const closeExpenseDetail = useCallback(() => {
    setViewingExpense(null);
  }, []);

  const closeViewingIfDeleted = useCallback((expenseId: number) => {
    setViewingExpense((current) => current?.id === expenseId ? null : current);
  }, []);

  const openBudgetModal = useCallback(() => setShowBudgetModal(true), []);
  const closeBudgetModal = useCallback(() => setShowBudgetModal(false), []);

  const closeForLock = useCallback(() => {
    window.dispatchEvent(new Event('spendwise-native-back'));
    setShowAddModal(false);
    setEditingExpense(null);
    setViewingExpense(null);
    setShowBudgetModal(false);
  }, []);

  return {
    showAddModal,
    editingExpense,
    viewingExpense,
    showBudgetModal,
    expenseEditorOpen: showAddModal || editingExpense !== null,
    openAddExpense,
    openEditExpense,
    closeExpenseEditor,
    openExpenseDetail,
    closeExpenseDetail,
    closeViewingIfDeleted,
    openBudgetModal,
    closeBudgetModal,
    closeForLock,
  };
}
