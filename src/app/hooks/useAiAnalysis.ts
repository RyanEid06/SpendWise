import { AI_PROCESSING_TIMEOUT_MS } from '../../security/aiOperationBudget';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiAnalysisResult, Expense, Language } from '../../types';
import { apiFetchJson } from '../../utils/api';
import { diagnostics } from '../../services/diagnostics/diagnostics';
import { getAiErrorMessage, normalizeApiException, SpendWiseApiError } from '../../utils/apiErrors';
import { parseAnalysisResult } from '../../utils/aiResultValidation';
import { useAiOperation } from './useAiOperation';
import { getMonthKey, MonthYear } from '../../utils/date';
import { SpendingAnalyzer } from '../../utils/spendingAnalyzer';
import { StorageManager } from '../../utils/storage';
import { getLocalizedMonthName, t } from '../../utils/translations';

import { AiRequestGate } from './aiRequestGate';

interface UseAiAnalysisOptions {
  expenses: Expense[];
  monthlyExpenses: Expense[];
  currentMonthYear: MonthYear;
  currencyCode: string;
  language: Language;
}

export function useAiAnalysis({
  expenses,
  monthlyExpenses,
  currentMonthYear,
  currencyCode,
  language,
}: UseAiAnalysisOptions) {
  const { operation, progress } = useAiOperation();
  const [retryAllowed, setRetryAllowed] = useState(true);
  const [result, setResult] = useState<AiAnalysisResult | null>(() =>
    StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestGateRef = useRef(new AiRequestGate());

  const reloadCached = useCallback(() => {
    requestGateRef.current.invalidate();
    operation.reset();
    setIsLoading(false);
    setResult(StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear)));
    setError(null);
    setNotice(null);
  }, [currentMonthYear, operation]);

  useEffect(() => {
    reloadCached();
  }, [reloadCached, expenses, currencyCode, language]);

  useEffect(() => () => {
    requestGateRef.current.invalidate();
  }, []);

  const analyze = useCallback(async () => {
    if (expenses.length === 0) {
      setError(t(language, 'noExpensesYetForAi'));
      return;
    }

    if (monthlyExpenses.length === 0) {
      setError(t(language, 'noExpensesForAi', { month: getLocalizedMonthName(currentMonthYear, language) }));
      return;
    }

    const requestId = requestGateRef.current.begin();
    if (requestId === null) return;
    const run = operation.begin();
    if (!run) { requestGateRef.current.finish(requestId); return; }

    setIsLoading(true);
    setError(null);
    setNotice(null);
    setRetryAllowed(true);

    const analyzer = new SpendingAnalyzer();
    const summary = analyzer.computeHistoricalSummary(expenses, currentMonthYear);
    const localFallback = analyzer.generateStatisticalAnalysis(summary, currencyCode);

    try {
      const response = await apiFetchJson<unknown>(
        '/api/gemini/analyze',
        {
          method: 'POST',
          signal: run.signal,
          onPhase: run.onPhase,
          body: JSON.stringify({
            summary,
            currencyCode,
            language,
          }),
        },
        AI_PROCESSING_TIMEOUT_MS
      );

      if (!requestGateRef.current.isCurrent(requestId) || !run.isCurrent()) return;
      const data = parseAnalysisResult(response, getMonthKey(currentMonthYear));
      if (!data) throw new SpendWiseApiError('invalid_response');
      StorageManager.cacheAnalysis(data);
      setResult(data);
      run.finish('ready');
    } catch (analysisError) {
      if (!requestGateRef.current.isCurrent(requestId) || !run.isCurrent()) return;
      diagnostics.record({ operation: 'ai.fallback', outcome: 'fallback', code: 'AI_LOCAL_FALLBACK' });
      StorageManager.cacheAnalysis(localFallback);
      setResult(localFallback);
      setNotice(`${getAiErrorMessage(language, analysisError)} ${t(language, 'aiFallbackNotice')}`);
      setRetryAllowed(normalizeApiException(analysisError).kind !== 'quota_exhausted');
      run.finish('local');
    } finally {
      if (requestGateRef.current.finish(requestId)) {
        setIsLoading(false);
      }
    }
  }, [currencyCode, currentMonthYear, expenses, language, monthlyExpenses, operation]);

  const cancel = useCallback(() => {
    requestGateRef.current.invalidate();
    operation.cancel();
    setIsLoading(false);
    setError(null);
    setNotice(null);
  }, [operation]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    requestGateRef.current.invalidate();
    operation.reset();
    setIsLoading(false);
    setResult(null);
    setError(null);
    setNotice(null);
  }, [operation]);

  return {
    result,
    isLoading,
    error,
    notice,
    analyze,
    clearResult,
    reset,
    reloadCached,
    progress,
    cancel,
    retryAllowed,
  };
}
