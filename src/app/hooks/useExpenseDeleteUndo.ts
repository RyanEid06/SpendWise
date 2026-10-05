import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { Expense } from '../../types';
import { expenseService } from '../../features/expenses/ExpenseService';
import { diagnostics } from '../../services/diagnostics/diagnostics';
import {
  ExpenseDeleteUndoController,
  restorePendingExpenses,
} from '../../utils/undoDeleteBatch';

interface UseExpenseDeleteUndoOptions {
  expenses: Expense[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  onAnalysisInvalidated: () => void;
  onExpenseStaged?: (expenseId: number) => void;
}

export function useExpenseDeleteUndo({
  expenses,
  setExpenses,
  onAnalysisInvalidated,
  onExpenseStaged,
}: UseExpenseDeleteUndoOptions) {
  const [pendingCount, setPendingCount] = useState(0);
  const [commitError, setCommitError] = useState(false);
  const analysisInvalidatedRef = useRef(onAnalysisInvalidated);
  const expenseStagedRef = useRef(onExpenseStaged);
  analysisInvalidatedRef.current = onAnalysisInvalidated;
  expenseStagedRef.current = onExpenseStaged;

  const controllerRef = useRef<ExpenseDeleteUndoController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new ExpenseDeleteUndoController({
      onBatchChange: (snapshot) => setPendingCount(snapshot?.count ?? 0),
      onCommit: async (entries) => {
        await expenseService.permanentDelete(entries.map((entry) => entry.expense.id));
      },
      onCommitError: (entries) => {
        diagnostics.record({ operation: 'delete.commit', outcome: 'failure', code: 'DELETE_COMMIT_FAILED' });
        setExpenses((current) => restorePendingExpenses(current, entries));
        setCommitError(true);
      },
    });
  }

  const getPendingExpenseIds = useCallback(
    () => controllerRef.current?.getPendingExpenseIds() ?? [],
    []
  );

  const undoPending = useCallback(() => {
    const entries = controllerRef.current?.undo() ?? [];
    if (entries.length === 0) return;
    setExpenses((current) => restorePendingExpenses(current, entries));
    expenseService.clearAnalysisCache();
    analysisInvalidatedRef.current();
    setCommitError(false);
  }, [setExpenses]);

  const disposePending = useCallback(() => {
    return controllerRef.current?.dispose() ?? [];
  }, []);

  const stageDelete = useCallback((expense: Expense) => {
    const currentIndex = expenses.findIndex((item) => item.id === expense.id);
    if (currentIndex < 0) return false;
    if (!controllerRef.current?.stage(expense, currentIndex)) return false;

    expenseService.clearAnalysisCache();
    analysisInvalidatedRef.current();
    setCommitError(false);
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    expenseStagedRef.current?.(expense.id);
    return true;
  }, [expenses, setExpenses]);

  useEffect(() => () => {
    controllerRef.current?.dispose();
  }, []);

  return {
    pendingCount,
    commitError,
    stageDelete,
    undoPending,
    disposePending,
    getPendingExpenseIds,
    dismissCommitError: () => setCommitError(false),
  };
}
