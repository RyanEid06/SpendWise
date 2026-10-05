import { useCallback, useEffect, useRef, useState } from 'react';
import { AiAnalysisResult, Expense, Language } from '../../types';
import { apiFetchJson } from '../../utils/api';
import { diagnostics } from '../../services/diagnostics/diagnostics';
import { getAiErrorMessage } from '../../utils/apiErrors';
import { getDisplayName, getMonthKey, MonthYear } from '../../utils/date';
import { SpendingAnalyzer } from '../../utils/spendingAnalyzer';
import { StorageManager } from '../../utils/storage';
import { t } from '../../utils/translations';

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
  const [result, setResult] = useState<AiAnalysisResult | null>(() =>
    StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestGateRef = useRef(new AiRequestGate());

  const reloadCached = useCallback(() => {
    requestGateRef.current.invalidate();
    setIsLoading(false);
    setResult(StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear)));
    setError(null);
    setNotice(null);
  }, [currentMonthYear]);

  useEffect(() => {
    reloadCached();
  }, [reloadCached, expenses, currencyCode, language]);

  useEffect(() => () => {
    requestGateRef.current.invalidate();
  }, []);

  const analyze = useCallback(async () => {
    if (expenses.length === 0) {
      setError('No expenses recorded yet. Please add some expenses before analyzing your spending.');
      return;
    }

    if (monthlyExpenses.length === 0) {
      setError(
        `No expenses recorded for ${getDisplayName(
          currentMonthYear
        )}. Switch to a month with recorded expenses to run analysis.`
      );
      return;
    }

    const requestId = requestGateRef.current.begin();
    if (requestId === null) return;

    setIsLoading(true);
    setError(null);
    setNotice(null);

    const analyzer = new SpendingAnalyzer();
    const summary = analyzer.computeHistoricalSummary(expenses, currentMonthYear);
    const localFallback = analyzer.generateStatisticalAnalysis(summary, currencyCode);

    try {
      const data = await apiFetchJson<AiAnalysisResult>(
        '/api/gemini/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            summary,
            currencyCode,
            language,
          }),
        },
        30000
      );

      if (!requestGateRef.current.isCurrent(requestId)) return;
      StorageManager.cacheAnalysis(data);
      setResult(data);
    } catch (analysisError) {
      if (!requestGateRef.current.isCurrent(requestId)) return;
      diagnostics.record({ operation: 'ai.fallback', outcome: 'fallback', code: 'AI_LOCAL_FALLBACK' });
      StorageManager.cacheAnalysis(localFallback);
      setResult(localFallback);
      setNotice(`${getAiErrorMessage(language, analysisError)} ${t(language, 'aiFallbackNotice')}`);
    } finally {
      if (requestGateRef.current.finish(requestId)) {
        setIsLoading(false);
      }
    }
  }, [currencyCode, currentMonthYear, expenses, language, monthlyExpenses]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    requestGateRef.current.invalidate();
    setIsLoading(false);
    setResult(null);
    setError(null);
    setNotice(null);
  }, []);

  return {
    result,
    isLoading,
    error,
    notice,
    analyze,
    clearResult,
    reset,
    reloadCached,
  };
}
