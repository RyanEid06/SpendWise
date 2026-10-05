import React, { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { BENCHMARK_ANCHOR, BENCHMARK_SIZES, createSyntheticLedger } from '../../../scripts/wp33/fixtures';
import { HistoryScreen } from '../../../src/screens/HistoryScreen';
import { StatisticsScreen } from '../../../src/screens/StatisticsScreen';
import { StorageManager } from '../../../src/utils/storage';
import { selectMonthlyLedger } from '../../../src/app/selectors/monthlyLedger';

interface Profile { phase: string; actualDurationMs: number; baseDurationMs: number; commitSinceRenderStartMs: number; }
declare global { interface Window { __WP33_METRICS__?: { startedAt: number; storageInitMs: number; profiles: Profile[]; }; } }
const params = new URLSearchParams(location.search);
const size = Number(params.get('size'));
if (!(BENCHMARK_SIZES as readonly number[]).includes(size)) throw new Error('INVALID_SYNTHETIC_BENCHMARK_SIZE');
const state = createSyntheticLedger(size);
if (params.get('distribution') === 'concentrated') {
  state.expenses = state.expenses.map((item, index) => ({ ...item, date: Date.UTC(2026, 9, 1 + index % 28, 12), createdAt: Date.UTC(2026, 9, 1 + index % 28, 12) + index }));
}
const monthly = selectMonthlyLedger(state.expenses, state.budgets, BENCHMARK_ANCHOR).monthlyExpenses;
const storageStart = performance.now(); await StorageManager.init();
window.__WP33_METRICS__ = { storageInitMs: performance.now() - storageStart, startedAt: performance.now(), profiles: [] };
const onRender: React.ProfilerOnRenderCallback = (_id, phase, actualDuration, baseDuration, _startTime, commitTime) => {
  const metrics = window.__WP33_METRICS__!;
  metrics.profiles.push({ phase, actualDurationMs: actualDuration, baseDurationMs: baseDuration, commitSinceRenderStartMs: commitTime - metrics.startedAt });
  if (metrics.profiles.length > 64) metrics.profiles.shift();
};
const noAction = () => {};
createRoot(document.getElementById('root')!).render(
  <Profiler id="wp33-synthetic-screen" onRender={onRender}>
    {params.get('screen') === 'statistics' ? <StatisticsScreen expenses={state.expenses} budgets={state.budgets} currentMonthYear={BENCHMARK_ANCHOR} currencyCode="USD" language="en" /> :
      <HistoryScreen expenses={monthly} currentMonthYear={BENCHMARK_ANCHOR} currencyCode="USD" language="en" onPreviousMonth={noAction} onNextMonth={noAction} onExpenseClick={noAction} onDeleteExpense={noAction} onAddExpenseClick={noAction} />}
  </Profiler>
);
