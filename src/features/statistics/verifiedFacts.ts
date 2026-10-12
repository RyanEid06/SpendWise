import type { Language, TimePeriod } from '../../types';
import { getLocalizedCategoryName } from '../../utils/translations';
import { statisticsText } from './copy';

type Month = { monthKey: string; totalSpent: number; isPartialMonth: boolean; dataAvailability?: 'recorded' | 'missing' };
type Category = { category: string; totalSpent: number; monthlyData: { monthKey: string; amount: number }[] };
export type TrendStatistics = { period?: TimePeriod; periodLabel: string; totalSpent: number; totalTransactions: number;
  monthlyStats: Month[]; categoryTrends: Category[] };
type Fact = { id: string; text: string };
const sum = (values: number[]) => values.reduce((a,b) => a+b, 0);
const ordinal = (key: string) => Number(key.slice(0,4))*12+Number(key.slice(5,7));

/** Shared by server rendering and offline fallback; no model-authored financial prose. */
export function buildVerifiedTrendFacts(stats: TrendStatistics, currency: string, language: Language) {
  const text = (key: Parameters<typeof statisticsText>[1], values: Record<string,string|number> = {}) => statisticsText(language,key,values);
  const money = (value: number) => new Intl.NumberFormat(language,{style:'currency',currency}).format(value);
  const percentage = (value: number) => new Intl.NumberFormat(language,{style:'percent', maximumFractionDigits:2}).format(value);
  const changePercent = (change: number, baseline: number) => baseline<=0 ? text('zeroBase')
    : !Number.isFinite(change/baseline) || money(baseline)===money(0) ? text('percentUnavailable') : ` (${percentage(Math.abs(change)/baseline)})`;
  const brief = (names: string[]) => names.slice(0,3).join(', ') + (names.length>3 ? text('more',{count:names.length-3}) : '');
  const range = (months: Month[]) => months.length===1 ? months[0].monthKey : `${months[0].monthKey}–${months.at(-1)!.monthKey}`;
  const unique = new Set(stats.monthlyStats.map(m=>m.monthKey)).size === stats.monthlyStats.length;
  const complete = unique ? stats.monthlyStats.filter(m=>!m.isPartialMonth && m.dataAvailability!=='missing').sort((a,b)=>a.monthKey.localeCompare(b.monthKey)) : [];
  const contiguous = complete.every((m,i)=> i===0 || ordinal(m.monthKey)===ordinal(complete[i-1].monthKey)+1);
  const short = stats.period==='LAST_3_MONTHS' || !stats.period;
  const size = stats.period==='CURRENT_MONTH' ? 0 : short ? 1 : Math.min(3,Math.floor(complete.length/2));
  const before = contiguous && complete.length>=2 && size>0 ? complete.slice(0,size) : [];
  const after = before.length ? complete.slice(-size) : [];
  const averageBefore = before.length ? sum(before.map(m=>m.totalSpent))/size : 0;
  const averageAfter = after.length ? sum(after.map(m=>m.totalSpent))/size : 0;
  const delta = averageAfter-averageBefore;
  const direction = (change: number) => text(Math.abs(change)<1e-8 ? 'stable' : change>0 ? 'increase' : 'decrease');
  const summary = before.length ? text('comparison', { direction:direction(delta),delta:money(Math.abs(delta)),
    percent: changePercent(delta, averageBefore),
    before:money(averageBefore),after:money(averageAfter),count:size,first:range(before),last:range(after) })
    : text('total',{total:money(stats.totalSpent),count:stats.totalTransactions,average:money(stats.totalTransactions>0 ? stats.totalSpent/stats.totalTransactions : 0)})
      + (stats.monthlyStats.length>1 && stats.period!=='CURRENT_MONTH' ? ` ${text('insufficient')}` : '');
  const observations: Fact[] = [];
  if (complete.length>1) {
    const nonzero = complete.filter(m=>m.totalSpent>0);
    if (nonzero.length) {
      const peak = Math.max(...nonzero.map(m=>m.totalSpent)), low = Math.min(...nonzero.map(m=>m.totalSpent));
      for (const [id,key,value] of [['peak-month','peak',peak],['low-month','low',low]] as const) {
        if (key==='low' && peak===low) continue;
        const months = nonzero.filter(m=>m.totalSpent===value);
        observations.push({id,text:text(key,{tie:months.length>1 ? text('tied') : '',months:brief(months.map(m=>m.monthKey)),amount:money(value)})});
      }
    }
  }
  const ordered = [...stats.categoryTrends].sort((a,b)=>b.totalSpent-a.totalSpent || a.category.localeCompare(b.category));
  const categories: Fact[] = ordered.filter(c=>c.totalSpent>0 && stats.totalSpent>0 && c.totalSpent<=stats.totalSpent).map((c,index)=>({id:`category-${index}`,text:text('share',{
    name:getLocalizedCategoryName(c.category,language), amount:money(c.totalSpent), percent:percentage(c.totalSpent/stats.totalSpent),
    rank:ordered.findIndex(o=>o.totalSpent===c.totalSpent)+1 })}));
  const changes = before.length ? stats.categoryTrends.flatMap(c=>{
    const amounts = (window: Month[]) => window.flatMap(m=>{
      const entries = c.monthlyData.filter(d=>d.monthKey===m.monthKey);
      return entries.length===1 ? [entries[0].amount] : [];
    });
    const early=amounts(before),recent=amounts(after);
    return early.length===size && recent.length===size ? [{category:c.category,delta:(sum(recent)-sum(early))/size}] : [];
  }) : [];
  let recommendation = '';
  for (const increase of [true,false]) {
    // A missing category baseline could hide a larger contribution. Do not
    // promote an available category to a superlative over unknown comparisons.
    if (changes.length !== stats.categoryTrends.length) continue;
    const eligible = changes.filter(c=>increase ? c.delta>1e-8 : c.delta < -1e-8);
    if (!eligible.length) continue;
    const largest=Math.max(...eligible.map(c=>Math.abs(c.delta)));
    const winners=eligible.filter(c=>Math.abs(Math.abs(c.delta)-largest)<1e-8).sort((a,b)=>a.category.localeCompare(b.category));
    const names=brief(winners.map(c=>getLocalizedCategoryName(c.category,language)));
    categories.unshift({id:increase?'driver-increase':'driver-decrease',text:text('driver',{name:names,tie:winners.length>1?text('tied'):'',
      direction:direction(winners[0].delta),delta:money(largest),first:range(before),last:range(after)})});
    if(increase && delta>1e-8) recommendation=text('review',{name:names});
  }
  // Preserve WP36 period-less fact IDs. New clients use window-specific category highlights.
  if (!stats.period && complete.length>=2 && contiguous) {
    const previous=complete.at(-2)!,latest=complete.at(-1)!;
    stats.categoryTrends.forEach((c,index)=>{
      const early=c.monthlyData.filter(m=>m.monthKey===previous.monthKey),recent=c.monthlyData.filter(m=>m.monthKey===latest.monthKey);
      if(early.length!==1 || recent.length!==1 || early[0].amount<=0) return;
      const change=recent[0].amount-early[0].amount;
      observations.push({id:`trend-${index}`,text:text('categoryComparison',{name:getLocalizedCategoryName(c.category,language),direction:direction(change),delta:money(Math.abs(change)),
        percent:changePercent(change,early[0].amount),before:money(early[0].amount),after:money(recent[0].amount),count:1,first:previous.monthKey,last:latest.monthKey})});
    });
  }
  return {summary, observations, categories, recommendation};
}
