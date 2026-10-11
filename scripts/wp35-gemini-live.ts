// Explicit opt-in only. No production routes, retries, secrets or raw model output in evidence.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { SpendingAnalyzer } from '../src/utils/spendingAnalyzer';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { matchesGeminiSchema } from '../server/validation/geminiSchema';
import { normalizeGeminiFailure } from '../server/geminiReliability';
import type { GeminiJsonRequest } from '../server/services/GeminiService';
import { geminiService } from '../server/services/GeminiService';
import { analysisRouter } from '../server/routes/analysis';
import { trendsRouter } from '../server/routes/trends';
import { smartCaptureRouter } from '../server/routes/smartCapture';
import { receiptScanRouter } from '../server/routes/receiptScan';

if (!process.argv.includes('--run-synthetic-free-tier')) throw new Error('Explicit live-test opt-in required.');
const key = (existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')).GEMINI_API_KEY?.trim() : undefined) || process.env.GEMINI_API_KEY?.trim();
if (!key || !/^[\x21-\x7e]+$/.test(key)) throw new Error('Missing or invalid local credential; never print it.');
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 50_000, retryOptions: { attempts: 1 } } });
const wp36 = process.argv.includes('--wp36-revalidate');
const spendingOnly = wp36 && process.argv.includes('--qualify-spending-facts');
const locales = wp36 && process.argv.includes('--qualify-locales');
const evidence: any = { kind: 'actual-google-api-synthetic-only', tierEvidence: 'WP35 owner-attested Free tier; current billing tier not independently observable', startedAt: new Date().toISOString(), requestCap: spendingOnly ? 3 : wp36 ? 8 : 10, perRequestTimeoutMs: 50_000, metadata: [], results: [] };
const output = spendingOnly ? 'artifacts/wp36/live-spending-facts.json' : wp36 ? locales ? 'artifacts/wp36/live-locales.json' : 'artifacts/wp36/live-results.json' : 'artifacts/wp35-live/results.json'; mkdirSync(wp36 ? 'artifacts/wp36' : 'artifacts/wp35-live', { recursive: true });
const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));
const names = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
const listed: string[] = [];
try {
  const pager = await ai.models.list({ config: { pageSize: 100, httpOptions: { timeout: 15_000, retryOptions: { attempts: 1 } } } });
  for (const model of pager.page) if (names.includes(model.name?.replace('models/', '') || '')) {
    const name = model.name!.replace('models/', ''); listed.push(name);
    evidence.metadata.push({ name, supportedActions: model.supportedActions, inputTokenLimit: model.inputTokenLimit, outputTokenLimit: model.outputTokenLimit });
  }
} catch (error) { evidence.metadataFailure = normalizeGeminiFailure(error).code; save(); process.exit(1); }
save();

const expenses = [
  { id: 1, amount: 12.5, description: 'Synthetic coffee', category: 'Food', date: Date.UTC(2026, 9, 1), note: null, createdAt: 1 },
  { id: 2, amount: 37.5, description: 'Synthetic groceries', category: 'Groceries', date: Date.UTC(2026, 9, 2), note: null, createdAt: 2 },
  { id: 3, amount: 100, description: 'Synthetic prior groceries', category: 'Groceries', date: Date.UTC(2026, 8, 1), note: null, createdAt: 3 },
];
const summary = new SpendingAnalyzer().computeHistoricalSummary(expenses, { year: 2026, month: 10 });
const stats = StatisticsEngine.calculateStatistics(expenses, [], 'LAST_3_MONTHS', { year: 2026, month: 10 });
const parts = (file: string) => ({ imageBase64: readFileSync('artifacts/wp35-live/'+file+'.png').toString('base64'), mimeType: 'image/png', currencyCode: 'USD', language: 'en' });
const baseFixtures = [
  { task: 'analyze', router: analysisRouter, body: { summary, currencyCode: 'USD', language: 'en' } },
  { task: 'explain-trends', router: trendsRouter, body: { stats, currencyCode: 'USD', language: 'en' } },
  { task: 'smart-capture', router: smartCaptureRouter, body: parts('purchase') },
  { task: 'scan-receipt', router: receiptScanRouter, body: parts('receipt') },
];
const fixtures = spendingOnly ? ['en', 'fr', 'ar'].map(language => ({ ...baseFixtures[0], body: { ...baseFixtures[0].body, language } }))
  : locales ? ['fr', 'ar'].flatMap(language => baseFixtures.map(fixture => ({ ...fixture, body: { ...fixture.body, language } }))) : baseFixtures;
const requests = new Map<string, GeminiJsonRequest<any>>();
// Capture actual route prompts/schema with synthetic bodies, never send to Render.
const original = geminiService.generateJson;
let capturing = '';
try {
  geminiService.generateJson = async (request: GeminiJsonRequest<any>) => { requests.set(capturing, request); throw new Error('CAPTURE_ONLY'); };
  for (const f of fixtures) {
    capturing = `${f.task}:${f.body.language}`;
    const handler = (f.router as any).stack.find((s: any) => s.route)?.route.stack[0].handle;
    const res: any = { locals: {}, status() { return this; }, json() { return this; } };
    await handler({ body: f.body }, res);
  }
} finally { geminiService.generateJson = original; }
if (requests.size !== fixtures.length) throw new Error('Synthetic fixture failed route validation.');
const cases = locales || spendingOnly ? fixtures.map(f => ({ task: f.task, language: f.body.language, model: names[2], thinking: 'low' as const, variant: spendingOnly ? 'wp36-spending-facts' : 'wp36-lite-locale' })) : wp36 ? [
  ...fixtures.map(f => ({ task: f.task, model: names[0], thinking: undefined as 'low' | undefined, variant: 'wp36-default' })),
  ...fixtures.map(f => ({ task: f.task, model: names[2], thinking: 'low' as const, variant: 'wp36-lite-candidate' })),
] : [
  ...fixtures.map(f => ({ task: f.task, model: names[0], thinking: undefined as 'low' | undefined, variant: 'default' })),
  ...['analyze', 'explain-trends'].map(task => ({ task, model: names[0], thinking: 'low' as const, variant: 'flash-low' })),
  ...fixtures.map(f => ({ task: f.task, model: names[2], thinking: 'low' as const, variant: 'lite-low' })),
];
for (const probe of cases.slice(0, evidence.requestCap)) {
  if (!listed.includes(probe.model)) { evidence.results.push({ ...probe, skipped: 'not-listed' }); continue; }
  const req = requests.get(`${probe.task}:${'language' in probe ? probe.language : 'en'}`)!; const started = performance.now();
  const probeSignal = AbortSignal.timeout(50_000);
  const result: any = { ...probe, attempts: 1 };
  try {
    const response = await ai.models.generateContent({ model: probe.model, contents: req.contents, config: {
      systemInstruction: req.systemInstruction, responseMimeType: 'application/json', responseJsonSchema: req.responseJsonSchema,
      abortSignal: probeSignal, httpOptions: { timeout: 50_000, retryOptions: { attempts: 1 } },
      ...(probe.thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
    } });
    let value: any; try { value = JSON.parse(response.text || ''); result.jsonValid = true; } catch { result.jsonValid = false; }
    result.schemaValid = matchesGeminiSchema(value, req.responseJsonSchema);
    result.sanitizerValid = result.schemaValid && req.validate(value) != null;
    if (probe.task === 'smart-capture') result.financialGate = value?.amount === 12.5 && value?.detectedCurrencyCode === 'USD' && value?.priceVisible === true;
    if (probe.task === 'scan-receipt') {
      result.financialGate = value?.totalAmount === 6 && value?.totalKind === 'total' && value?.totalIsReliable === true && value?.detectedCurrencyCode === 'USD' && value?.multipleCurrencies === false;
      result.ocrGate = value?.merchant?.toUpperCase() === 'SYNTHETIC TEST STORE' && value?.date === '2026-10-01' && value?.items?.some((s: string) => /coffee/i.test(s)) && value?.items?.some((s: string) => /bread/i.test(s));
    }
    if (probe.task === 'explain-trends') result.financialGate = result.sanitizerValid; // Only validated IDs; all displayed financial prose is deterministic.
    if (probe.task === 'analyze') result.financialGate = result.sanitizerValid; // Verified IDs; no provider-authored financial prose.
    result.usage = { promptTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount, thinkingTokens: response.usageMetadata?.thoughtsTokenCount, totalTokens: response.usageMetadata?.totalTokenCount };
    result.qualityPass = Boolean(result.jsonValid && result.schemaValid && result.sanitizerValid && result.financialGate && (probe.task !== 'scan-receipt' || result.ocrGate));
  } catch (error) {
    const f = normalizeGeminiFailure(error); result.failure = probeSignal.aborted ? 'AI_TIMEOUT' : f.code; result.upstreamStatus = f.upstreamStatus;
    result.clientAbort = probeSignal.aborted;
    if (f.code === 'AI_QUOTA_EXHAUSTED' || f.upstreamStatus === 401 || f.upstreamStatus === 403) { evidence.stopped = f.code; result.latencyMs = Math.round(performance.now() - started); evidence.results.push(result); save(); break; }
  }
  result.latencyMs = Math.round(performance.now() - started); evidence.results.push(result); save();
  console.info(JSON.stringify(result));
}
evidence.completedAt = new Date().toISOString(); save();
console.info(JSON.stringify({ evidence: output, generationAttempts: evidence.results.filter((r: any) => !r.skipped).length }));
