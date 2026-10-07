import { useEffect, useState } from 'react';
import type { Expense } from '../../types';
import type { ExpenseEditorDraft } from '../../data/ExpenseDraft';
import { expenseDraftRecoveryService } from '../../services/ExpenseDraftRecoveryService';
import { LocalDataStore } from '../../utils/localDataStore';

export function useExpenseDraftRecovery(options: {
  enabled: boolean;
  expenses: Expense[];
  currencyCode: string;
  openAdd: () => void;
  openEdit: (expense: Expense) => void;
}) {
  const [draft, setDraft] = useState<ExpenseEditorDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [issue, setIssue] = useState<'missing-expense' | 'currency' | 'read' | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!options.enabled) { setReady(false); return; }
    void expenseDraftRecoveryService.restore().then(restored => {
      if (!active) return;
      setDraft(restored);
      setIssue(null);
      if (restored) {
        const target = options.expenses.find(e => e.id === restored.expenseId && e.createdAt === restored.expenseCreatedAt);
        if (restored.currencyCode !== options.currencyCode) setIssue('currency');
        else if (restored.expenseId != null && !target) setIssue('missing-expense');
        else if (target) options.openEdit(target);
        else options.openAdd();
      }
      setReady(true);
    }, () => { if (active) { setIssue('read'); setReady(true); } });
    return () => { active = false; };
    // Rehydrate only on authenticated entry. Ledger updates do not reopen saved editors.
  }, [options.enabled, attempt, options.openAdd, options.openEdit]);

  return {
    draft, ready, issue,
    closed: () => setDraft(null),
    retry: () => { setReady(false); setAttempt(value => value + 1); },
    continueAsNew: () => {
      if (!draft || issue !== 'missing-expense') return;
      setDraft({ ...draft, expenseId: null, expenseCreatedAt: null, removedAttachmentIds: [] });
      setIssue(null);
      options.openAdd();
    },
    discard: async () => {
      // Read failures preserve the opaque protected snapshot until an explicit discard.
      const id = draft?.id ?? LocalDataStore.getExpenseDraft()?.id;
      if (id) await expenseDraftRecoveryService.discard(id);
      setDraft(null);
      setIssue(null);
    },
  };
}
