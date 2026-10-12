import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { AiProgressPanel } from '../../../src/components/AiProgressPanel';
import type { AiProgress } from '../../../src/app/hooks/aiOperation';
import { ExpenseItemCard } from '../../../src/components/ExpenseItemCard';
import { TopExpensesSection } from '../../../src/components/TopExpensesSection';
import { ExpenseDetailModal } from '../../../src/components/ExpenseDetailModal';
import { LegalDocumentScreen } from '../../../src/screens/LegalDocumentScreen';
import { MediaLibraryScreen } from '../../../src/screens/MediaLibraryScreen';
import { StorageManager } from '../../../src/utils/storage';
import { useAiAnalysis } from '../../../src/app/hooks/useAiAnalysis';
import { AiInsightsScreen } from '../../../src/screens/AiInsightsScreen';
import type { Language } from '../../../src/types';

const params = new URLSearchParams(location.search);
const language = (params.get('lang') || 'ar') as Language;
document.documentElement.lang = language;
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
document.documentElement.classList.toggle('dark', params.has('dark'));
const expense = { id: 1, amount: 12, category: 'Travel', description: params.get('text') || 'Three Day Summer Trip to the Mediterranean coast', note: 'ملاحظة عربية', date: Date.now(), createdAt: Date.now() };
const stage = (params.get('stage') || 'sending') as AiProgress['stage'];
const active = !['idle', 'ready', 'error', 'cancelled', 'local'].includes(stage);
const mode = params.get('mode');
const analysisMonth = { year: 2025, month: 12 };
const noMonthlyExpenses: typeof expense[] = [];
const analysisExpenses = params.has('emptyMonth') ? [expense] : noMonthlyExpenses;
function EmptyAnalysisFixture() {
  const analysis = useAiAnalysis({ expenses: analysisExpenses, monthlyExpenses: noMonthlyExpenses, currentMonthYear: analysisMonth, currencyCode: 'USD', language });
  return <AiInsightsScreen currentMonthYear={analysisMonth} analysisResult={analysis.result} isLoading={analysis.isLoading} error={analysis.error} notice={analysis.notice} language={language} onPreviousMonth={() => {}} onNextMonth={() => {}} onAnalyzeClick={() => void analysis.analyze()} progress={analysis.progress} onCancel={analysis.cancel} />;
}
void StorageManager.init().then(async () => {
  if (mode === 'media') {
    const blob = await fetch('/tests/fixtures/media/wp32-photo-01.jpg').then(response => response.blob());
    await StorageManager.addExpense(expense, { newAttachments: [{ blob, mimeType: 'image/jpeg', kind: 'receipt', width: 32, height: 32, byteSize: blob.size }], removedAttachmentIds: [] });
  }
  createRoot(document.getElementById('root')!).render(
  mode === 'emptyAnalysis' ? <EmptyAnalysisFixture /> :
  mode === 'media' ? <MediaLibraryScreen language={language} onClose={() => {}} /> :
  mode === 'legal' ? <LegalDocumentScreen language={language} kind="privacy" onClose={() => { document.body.dataset.closed = 'true'; }} /> :
  mode === 'detail' ? <ExpenseDetailModal expense={expense} currencyCode="USD" language={language} onClose={() => {}} /> :
  <main className="max-w-sm p-4 space-y-4">
    <ExpenseItemCard expense={expense} language={language} currencyCode="USD" attachmentCount={0} onClick={() => {}} />
    <TopExpensesSection topExpenses={[expense]} language={language} currencyCode="USD" onExpenseClick={() => {}} />
    {(['indigo', 'cyan', 'purple'] as const).map(tone => <section key={tone} data-feature={tone} className="p-3 bg-slate-100 dark:bg-slate-900">
      <AiProgressPanel progress={{ stage, active }} language={language} tone={tone} onCancel={() => { document.body.dataset.cancelled = 'true'; }} onRetry={() => {}} />
    </section>)}
  </main>
  );
});
