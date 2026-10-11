import test from 'node:test';
import assert from 'node:assert/strict';
import { executeGeminiJsonWithModelFallback } from '../server/geminiReliability';
import { parseServerConfig } from '../server/config';
import { parseTaskRoutes } from '../server/taskRouting';
import { GeminiService } from '../server/services/GeminiService';
import { serverConfig } from '../server/config';

test('qualified task defaults use Lite first and a reachable distinct fallback without deprecated aliases', () => {
  const config = parseServerConfig({});
  assert.deepEqual(config.geminiModels, ['gemini-3.8-flash']);
  for (const task of ['analyze', 'explain-trends', 'smart-capture', 'scan-receipt'] as const) {
    assert.deepEqual(config.geminiTaskRoutes[task], { models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'], thinkingLevel: 'low' });
  }
  assert.equal(parseServerConfig({ GEMINI_MAX_ATTEMPTS: '1' }).geminiTaskRoutes.analyze?.models.length, 1);
  assert.deepEqual(parseServerConfig({ GEMINI_MODEL: 'gemini-3.8-flash' }).geminiTaskRoutes, {});
  const alias = parseServerConfig({ GEMINI_MODEL: 'gemini-3.7-flash', GEMINI_FALLBACK_MODELS: 'gemini-3.8-flash' });
  assert.deepEqual(alias.geminiModels, ['gemini-3.8-flash']);
  assert.throws(() => parseTaskRoutes({ GEMINI_TASK_ROUTES: JSON.stringify({ analyze: { models: ['gemini-3.8-flash', 'gemini-3.7-flash'] } }),
    GEMINI_ROUTING_QUALITY_APPROVED: 'true', GEMINI_VERIFIED_MODELS: 'gemini-3.8-flash,gemini-3.7-flash' }), /alias|distinct/i);
});

test('distinct legacy fallback overrides need quality attestation; task routes cannot name unreachable third models', () => {
  assert.throws(() => parseServerConfig({ GEMINI_FALLBACK_MODELS: 'gemini-3.5-flash-lite' }), /quality|verified/i);
  assert.throws(() => parseServerConfig({ GEMINI_TASK_ROUTES: JSON.stringify({ analyze: { models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'] } }),
    GEMINI_ROUTING_QUALITY_APPROVED: 'true', GEMINI_VERIFIED_MODELS: 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.6-flash' }), /attempt|reachable/i);
});

for (const task of ['analyze', 'explain-trends', 'smart-capture', 'scan-receipt']) {
  const options = { endpoint: `/api/gemini/${task}`, requestId: 'synthetic', models: ['primary', 'qualified-fallback'],
    timeoutMs: 50, operationBudgetMs: 500, maxAttempts: 2, minAttemptBudgetMs: 5, retryDelayMs: 0,
    random: () => 0, validate: (v: any) => v?.ok === true ? true : null };
  test(`${task}: immediate success and transient provider/network failures use one bounded fallback`, async () => {
    for (const error of [null, { status: 408 }, { status: 429 }, { status: 500 }, { status: 502 }, { status: 503 }, { status: 504 }, { code: 'ECONNRESET' }]) {
      const calls: string[] = [];
      const result = await executeGeminiJsonWithModelFallback({ ...options, request: async model => {
        calls.push(model); if (error && calls.length === 1) throw error; return { text: '{"ok":true}' };
      } });
      assert.equal(result, true);
      assert.deepEqual(calls, error ? ['primary', 'qualified-fallback'] : ['primary']);
    }
  });
  test(`${task}: actual service dispatches qualified Lite/low then Flash/low within the shared budget`, async t => {
    const service = new GeminiService(); const dispatched: any[] = [];
    const previous = serverConfig.geminiRetryDelayMs; serverConfig.geminiRetryDelayMs = 0;
    t.after(() => { serverConfig.geminiRetryDelayMs = previous; });
    (service as any).createClient = () => ({ models: { generateContent: async (request: any) => {
      dispatched.push(request);
      if (dispatched.length === 1) throw { status: 503 };
      return { text: '{"ok":true}' };
    } } });
    assert.equal(await service.generateJson({ endpoint: options.endpoint, requestId: options.requestId,
      contents: 'synthetic', systemInstruction: 'synthetic', responseJsonSchema: { type: 'object' }, validate: options.validate }), true);
    assert.deepEqual(dispatched.map(r => r.model), ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
    assert.ok(dispatched.every(r => r.config.thinkingConfig.thinkingLevel === 'LOW' && r.config.httpOptions.retryOptions.attempts === 1));
  });
  test(`${task}: auth/configuration, malformed JSON and failed validation never retry`, async () => {
    for (const response of [{ status: 401 }, { status: 403 }, { status: 404 }, { text: 'not JSON' }, { text: '{"ok":false}' }]) {
      let calls = 0;
      await assert.rejects(executeGeminiJsonWithModelFallback({ ...options, request: async () => {
        calls++; if ('status' in response) throw response; return response;
      } }));
      assert.equal(calls, 1);
    }
  });
  test(`${task}: cancellation and insufficient remaining budget never dispatch a doomed request`, async () => {
    let calls = 0;
    const controller = new AbortController(); controller.abort();
    await assert.rejects(executeGeminiJsonWithModelFallback({ ...options, signal: controller.signal,
      request: async () => { calls++; return { text: '{"ok":true}' }; } }), (e: any) => e.code === 'AI_CANCELLED');
    assert.equal(calls, 0);
    let clock = 0;
    await assert.rejects(executeGeminiJsonWithModelFallback({ ...options, operationBudgetMs: 90, now: () => clock,
      request: async () => { calls++; clock = 89; throw { status: 503 }; } }), (e: any) => e.code === 'AI_TEMPORARILY_UNAVAILABLE');
    assert.equal(calls, 1);
  });
}
