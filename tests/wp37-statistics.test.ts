import test from 'node:test';
import assert from 'node:assert/strict';
import { trendFacts } from '../server/validation/trendFacts';
import { sanitizeStatistics } from '../server/validation/requests';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { parseTrendResult } from '../src/utils/aiResultValidation';
import { statisticsCopy, statisticsText } from '../src/features/statistics/copy';

const month = (key: string, totalSpent: number, partial = false) => ({ monthKey: key, totalSpent,
  transactionCount: totalSpent ? 1 : 0, startingBudget: 0, remainingMoney: 0, isBudgetSet: false, isPartialMonth: partial });
const category = (name: string, amounts: number[], months: ReturnType<typeof month>[]) => ({ category: name,
  totalSpent: amounts.reduce((a,b) => a+b, 0), percentageOfPeriod: 0, trendDirection: 'STABLE', trendPercent: 0,
  monthlyData: months.map((m,i) => ({ monthKey: m.monthKey, amount: amounts[i], count: amounts[i] ? 1 : 0 })) });
const input = (period: string, months: ReturnType<typeof month>[], categories: ReturnType<typeof category>[] = []) => ({
  period, periodLabel: period, totalSpent: months.reduce((s,m) => s+m.totalSpent,0), totalTransactions: months.length,
  averageTransactionAmount: 0, monthlyStats: months, categoryTrends: categories });
const facts = (value: unknown, language: 'en' | 'fr' | 'ar' = 'en') => trendFacts(sanitizeStatistics(value)!, 'USD', language);
const result = (value: unknown, language: 'en' | 'fr' | 'ar' = 'en') => facts(value, language).validate({observationIds: [], categoryIds: []})!;

test('3-month comparison leads with complete first/latest months and excludes partial October', () => {
  const value = input('LAST_3_MONTHS', [month('2026-08',100),month('2026-09',150),month('2026-10',1,true)]);
  assert.match(result(value).summary, /2026-08.*2026-09/);
  assert.match(result(value).summary, /50%/);
  assert.doesNotMatch(result(value).summary, /2026-10|transactions|Average:/);
});

test('six months with a partial month uses labeled nonoverlapping two-month windows', () => {
  const months = [100,100,10000,200,200,1].map((n,i) => month(`2026-${String(i+5).padStart(2,'0')}`,n,i===5));
  const summary = result(input('LAST_6_MONTHS',months)).summary;
  assert.match(summary, /2 complete months/);
  assert.match(summary, /2026-05.*2026-06.*2026-08.*2026-09/);
  assert.match(summary, /100%/);
  assert.doesNotMatch(summary, /10,000|2026-07|2026-10/);
});

for (const period of ['LAST_6_MONTHS','LAST_12_MONTHS','ALL_TIME']) test(`${period} uses three-month window averages when available`, () => {
  const months = [100,100,100,150,150,150].map((n,i) => month(`2025-0${i+1}`,n));
  const summary = result(input(period,months)).summary;
  assert.match(summary, /3 complete months/);
  assert.match(summary, /50%/);
});

test('missing months and zero baselines never invent stability or percentage movement', () => {
  assert.doesNotMatch(result(input('ALL_TIME',[month('2025-01',100),month('2025-03',200)])).summary, /%|increased|decreased|stable/);
  const zero = result(input('LAST_3_MONTHS',[month('2025-01',0),month('2025-02',30)]));
  assert.match(zero.summary, /30/);
  assert.doesNotMatch(zero.summary, /%/);
  const missing = {...month('2025-01',0), dataAvailability:'missing'};
  assert.doesNotMatch(result(input('LAST_3_MONTHS',[missing,month('2025-02',30)])).summary, /increased|decreased|stable/);
});

test('category driver ranks absolute change, includes confirmed zero, excludes missing data and marks ties', () => {
  const months = [month('2025-01',1001),month('2025-02',1203)];
  const value = input('LAST_3_MONTHS',months,[category('Food',[1000,1200],months),category('Shopping',[1,3],months),category('Transportation',[0,100],months)]);
  const catalog = facts(value).catalog;
  const driver = catalog.categories.find(f => f.id === 'driver-increase');
  assert.match(driver?.text ?? '', /Food.*200/);
  assert.doesNotMatch(driver?.text ?? '', /Shopping|cause|because/);
  const zero = facts(input('LAST_3_MONTHS',months,[category('Transportation',[0,100],months)])).catalog.categories;
  assert.match(zero.find(f => f.id==='driver-increase')?.text ?? '', /100/);
  assert.doesNotMatch(zero.find(f => f.id==='driver-increase')?.text ?? '', /%/);
  const missingCategory = {...category('Food',[10,50],months),monthlyData:[{monthKey:'2025-02',amount:50,count:1}]};
  assert.equal(facts(input('LAST_3_MONTHS',months,[missingCategory])).catalog.categories.some(f=>f.id==='driver-increase'),false);
  const tied = facts(input('LAST_3_MONTHS',months,[category('Food',[10,30],months),category('Shopping',[10,30],months)])).catalog;
  assert.match(tied.categories.find(f=>f.id==='driver-increase')?.text ?? '', /tied/i);
});

test('peak and lowest observations exclude partial/missing months and show tied extrema honestly', () => {
  const catalog = facts(input('ALL_TIME',[month('2025-01',100),month('2025-02',100),month('2025-03',0),month('2025-04',999,true)])).catalog;
  assert.match(catalog.observations.find(f=>f.id==='peak-month')?.text ?? '', /tied.*2025-01.*2025-02/i);
  assert.doesNotMatch(JSON.stringify(catalog), /999/);
});

test('combined selection cap is global; unsupported claims fail closed and no filler is returned', () => {
  const months = [month('2025-01',100),month('2025-02',200),month('2025-03',150)];
  const f = facts(input('LAST_3_MONTHS',months,[category('Food',[100,200,150],months)]));
  assert.equal(f.validate({observationIds:['peak-month','low-month'],categoryIds:['category-0','driver-increase']}),null);
  assert.equal(f.validate({observationIds:[],categoryIds:[],summary:'999%'}),null);
  assert.equal(f.validate({observationIds:[],categoryIds:[]})?.recommendation,'');
});

test('legacy period-less payloads still render; new period and missing metadata survive sanitization', () => {
  const value = input('LAST_6_MONTHS',[{...month('2025-01',0),dataAvailability:'missing'}]);
  assert.equal((sanitizeStatistics(value) as any).period,'LAST_6_MONTHS');
  assert.equal((sanitizeStatistics(value) as any).monthlyStats[0].dataAvailability,'missing');
  const {period,...legacy} = value;
  assert.ok(facts(legacy).validate({observationIds:[],categoryIds:[]}));
});

test('sanitization does not silently discard All-Time history after 120 months', () => {
  const months = Array.from({length:144},(_,i)=>month(`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,10));
  assert.equal(sanitizeStatistics(input('ALL_TIME',months))?.monthlyStats.length,144);
});

test('oversized histories fail explicitly instead of silently truncating or removing resource bounds', () => {
  const months=Array.from({length:601},(_,i)=>month(`${1900+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,1));
  assert.ok(sanitizeStatistics(input('ALL_TIME',months))===null);
  assert.ok(sanitizeStatistics(input('ALL_TIME',[],Array.from({length:41},(_,i)=>category(`Category${i}`,[],[]))))===null);
});

test('local fallback uses localized deterministic facts and excludes partial-month comparisons', () => {
  const stats = StatisticsEngine.calculateStatistics([{id:1,amount:20,date:new Date(2025,0,2).getTime(),category:'Food',description:'Item'}] as any,[], 'LAST_3_MONTHS',{year:2025,month:3});
  const explanation = (StatisticsEngine.generateLocalTrendExplanation as any)(stats,'USD','fr');
  assert.match(explanation.summary,/dépenses|Dépenses|mois/);
  assert.doesNotMatch(JSON.stringify(explanation), /Spending remained|typical distributions|highest potential/);
});

test('new client accepts optional recommendation and compacts legacy backend responses globally', () => {
  const value = {timestamp:1,periodLabel:'All Time',summary:'Verified summary',keyObservations:['First','Second'],categoryHighlights:['Category 1','Category 2','Category 3']};
  const parsed = parseTrendResult(value);
  assert.ok(parsed);
  assert.equal(parsed.recommendation,'');
  assert.equal(parsed.keyObservations.length + parsed.categoryHighlights.length,3);
  const filler = parseTrendResult({...value,recommendation:'Review your expenses and budget before deciding on changes.'});
  assert.equal(filler?.recommendation,'');
});

test('Statistics copy has EN/FR/AR key and interpolation parity', () => {
  const keys = Object.keys(statisticsCopy.en);
  for (const language of ['en','fr','ar'] as const) {
    assert.deepEqual(Object.keys(statisticsCopy[language]).sort(),[...keys].sort());
    for (const key of keys as (keyof typeof statisticsCopy.en)[]) {
      const parameters = [...statisticsCopy.en[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
      assert.deepEqual([...statisticsCopy[language][key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),parameters);
      const values = Object.fromEntries(parameters.map(p=>[p,p==='count'?36:'SYNTHETIC']));
      assert.doesNotMatch(statisticsText(language,key,values),/\{\w+\}/);
    }
  }
});

test('category rows never bridge a missing calendar month or treat an unrecorded month as zero', () => {
  const expense=(id:number,month:number,amount:number)=>({id,date:new Date(2025,month-1,2).getTime(),amount,category:'Food',description:'Test'});
  const sparse=StatisticsEngine.calculateStatistics([expense(1,1,100),expense(2,3,200)] as any,[],'ALL_TIME',{year:2025,month:3});
  assert.equal(sparse.categoryTrends[0].hasComparableHistory,false);
  const missing=StatisticsEngine.calculateStatistics([expense(1,1,100),expense(2,3,200)] as any,[],'LAST_3_MONTHS',{year:2025,month:3});
  assert.equal(missing.categoryTrends[0].hasComparableHistory,false);
  assert.equal(missing.monthlyStats[1].dataAvailability,'missing');
});

test('CURRENT_MONTH remains descriptive; decrease facts and zero-spending periods stay literal', () => {
  const months=[month('2025-01',200),month('2025-02',100)];
  assert.doesNotMatch(result(input('CURRENT_MONTH',months)).summary,/increased|decreased/);
  const f=facts(input('LAST_3_MONTHS',months,[category('Food',[200,100],months)]));
  assert.match(f.catalog.categories.find(c=>c.id==='driver-decrease')?.text ?? '',/Food.*100/);
  assert.equal(f.validate({observationIds:[],categoryIds:['driver-decrease']})?.recommendation,'');
  const empty=result(input('ALL_TIME',[month('2025-01',0),month('2025-02',0)]));
  assert.doesNotMatch(empty.summary,/%|NaN|Infinity/);
});

test('very small nonzero baselines cannot overflow into an infinite financial percentage', () => {
  const months=[month('2025-01',1e-320),month('2025-02',100)];
  const value=input('LAST_3_MONTHS',months,[category('Food',[1e-320,100],months)]);
  const explanation=result(value);
  assert.doesNotMatch(explanation.summary,/∞|Infinity|NaN/);
  assert.match(explanation.summary,/percentage unavailable/);
});

test('category superlatives are omitted when another category lacks comparable window records', () => {
  const months=[month('2025-01',100),month('2025-02',200)];
  const complete=category('Food',[10,20],months);
  const incomplete={...category('Shopping',[0,180],months),monthlyData:[{monthKey:'2025-02',amount:180,count:1}]};
  assert.equal(facts(input('LAST_3_MONTHS',months,[complete,incomplete])).catalog.categories.some(f=>f.id.startsWith('driver-')),false);
});

for (const [language,name] of [['en','Food & Beverage'],['fr','Restauration et boissons'],['ar','الطعام والمشروبات']] as const) {
  test(`legacy category fact identifies its category when overall spending falls in ${language}`, () => {
    const months=[month('2025-01',100),month('2025-02',80)];
    const {period,...legacy}=input('LAST_3_MONTHS',months,[category('Food',[10,30],months),category('Groceries',[90,50],months)]);
    const f=facts(legacy,language);
    const response=f.validate({observationIds:['trend-0'],categoryIds:[]});
    assert.ok(response);
    assert.ok(response.keyObservations[0].includes(name));
    assert.match(response.keyObservations[0], /200|٢٠٠/); // Locale data may choose either Arabic numbering system.
    assert.match(response.keyObservations[0], /2025-01.*2025-02/);
    assert.ok(!response.summary.includes(name));
  });
}
