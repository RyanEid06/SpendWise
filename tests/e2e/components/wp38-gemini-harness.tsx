import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { useAiAnalysis } from '../../../src/app/hooks/useAiAnalysis';
import { AiInsightsScreen } from '../../../src/screens/AiInsightsScreen';
import { StatisticsScreen } from '../../../src/screens/StatisticsScreen';
import { SmartCaptureCard } from '../../../src/components/SmartCaptureCard';
import { ReceiptScanCard } from '../../../src/components/ReceiptScanCard';
import { SpendingAnalyzer } from '../../../src/utils/spendingAnalyzer';
import { StatisticsEngine } from '../../../src/utils/statisticsEngine';
import { StorageManager } from '../../../src/utils/storage';
import { AuthenticatedApiClient } from '../../../src/security/AuthenticatedApiClient';
import type { Language, SmartCaptureResult, ReceiptScanResult } from '../../../src/types';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'analysis';
const language = (params.get('lang') || 'en') as Language;
const month = { year: 2026, month: 10 };
const expenses = [{ id: 1, amount: 20, category: 'Food', description: 'Synthetic lunch', note: null,
  date: new Date(2026, 9, 5).getTime(), createdAt: new Date(2026, 9, 5).getTime() }];
const budgets: [] = [];
const photo = { blob: new Blob(['synthetic image'], { type: 'image/jpeg' }), mimeType: 'image/jpeg',
  kind: 'receipt' as const, width: 10, height: 10, byteSize: 15 };
const previousSmart: SmartCaptureResult | null = params.has('previousResult') ? {
  description: 'Previously reviewed synthetic purchase', category: 'Food', amount: 20,
  confidence: 'high', priceVisible: true, currencyMismatch: false,
} : null;
const previousReceipt: ReceiptScanResult | null = params.has('previousResult') ? {
  merchant: 'Previously reviewed synthetic merchant', totalAmount: 20, category: 'Food',
  items: ['Synthetic lunch'], currencyMismatch: false, isUncertain: false,
} : null;
let releaseResponse = () => {};
const delayedResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
const probe = { requests: 0, failLocal: params.has('failLocal'), failCache: params.has('failCache'),
  releaseResponse, analyze: async () => {}, cancel: () => {}, cache: () => StorageManager.getCachedAnalysis('2026-10') };
declare global { interface Window { __WP38_GEMINI__: typeof probe } }
window.__WP38_GEMINI__ = probe;

// Replace only the external HTTP boundary: real components, validation,
// operation ownership, fallback engines and storage remain in use.
AuthenticatedApiClient.prototype.fetch = async function (_path, init) {
  probe.requests++;
  init?.onPhase?.({ phase: 'ai_dispatch', outcome: 'start' });
  if (params.has('slow')) await delayedResponse;
  return Response.json({ error: params.has('transient') ? 'AI_TEMPORARILY_UNAVAILABLE' : 'AI_QUOTA_EXHAUSTED' },
    { status: params.has('transient') ? 503 : 429,
      headers: params.has('retryAfter') ? { 'Retry-After': '1' } : {} });
};
const originalSummary = SpendingAnalyzer.prototype.computeHistoricalSummary;
SpendingAnalyzer.prototype.computeHistoricalSummary = function (...args) {
  if (probe.failLocal && params.get('failLocal') === 'summary') throw new Error('SYNTHETIC_LOCAL_SUMMARY_FAILURE');
  return originalSummary.apply(this, args);
};
const originalFallback = SpendingAnalyzer.prototype.generateStatisticalAnalysis;
SpendingAnalyzer.prototype.generateStatisticalAnalysis = function (...args) {
  if (probe.failLocal) throw new Error('SYNTHETIC_LOCAL_FALLBACK_FAILURE');
  return originalFallback.apply(this, args);
};
const originalTrend = StatisticsEngine.generateLocalTrendExplanation;
StatisticsEngine.generateLocalTrendExplanation = function (...args) {
  if (probe.failLocal) throw new Error('SYNTHETIC_LOCAL_TREND_FAILURE');
  return originalTrend.apply(this, args);
};
const originalCache = StorageManager.cacheAnalysis;
StorageManager.cacheAnalysis = function (...args) {
  if (probe.failCache) throw new Error('SYNTHETIC_CACHE_WRITE_FAILURE');
  return originalCache.apply(this, args);
};

function Analysis({ currency }: { currency: string }) {
  const analysis = useAiAnalysis({ expenses, monthlyExpenses: expenses, currentMonthYear: month, currencyCode: currency, language });
  probe.analyze = analysis.analyze;
  probe.cancel = analysis.cancel;
  return <><output data-testid="analysis-state">{`${analysis.isLoading}/${analysis.progress.stage}/${analysis.progress.active}`}</output>
    <AiInsightsScreen currentMonthYear={month} analysisResult={analysis.result} isLoading={analysis.isLoading}
      error={analysis.error} notice={analysis.notice} language={language} onPreviousMonth={() => {}} onNextMonth={() => {}}
      onAnalyzeClick={() => void analysis.analyze()} progress={analysis.progress} onCancel={analysis.cancel} retryAllowed={analysis.retryAllowed} />
  </>;
}
function Fixture() {
  const [currency, setCurrency] = useState('USD');
  return <main className="max-w-md p-4"><button onClick={() => setCurrency(v => v === 'USD' ? 'EUR' : 'USD')}>Change context</button>
    {mode === 'statistics' ? <StatisticsScreen expenses={expenses} budgets={budgets} currentMonthYear={month} currencyCode={currency} language={language} /> :
      mode === 'smart' ? <SmartCaptureCard currencyCode={currency} language={language} onApply={() => {}}
        recoveryState={{ photo, result: previousSmart, interrupted: false, currencyCode: 'USD', language }} /> :
        mode === 'receipt' ? <ReceiptScanCard currencyCode={currency} language={language} onApply={() => {}}
          recoveryState={{ photo, result: previousReceipt, interrupted: false, currencyCode: 'USD', language }} /> : <Analysis currency={currency} />}
  </main>;
}
void StorageManager.init().then(() => createRoot(document.getElementById('root')!).render(<Fixture />));
