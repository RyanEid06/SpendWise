import test from 'node:test';
import assert from 'node:assert/strict';
import { executeGeminiJsonWithModelFallback, normalizeGeminiFailure } from '../server/geminiReliability';
import { parseServerConfig } from '../server/config';

const base = { endpoint: '/api/gemini/analyze', requestId: 'd0af7161-d7a2-4a27-8565-20abc1f766f0',
  models: ['primary', 'fallback', 'third'], timeoutMs: 50, operationBudgetMs: 90,
  maxAttempts: 2, minAttemptBudgetMs: 5, retryDelayMs: 0, random: () => 0,
  validate: (v: unknown) => (v as any)?.ok === true ? true : null };
const ok = { text: '{"ok":true}' };
const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (e: any) => e.code === code);

test('profiles clamp server budget below fixed Android processing bound and cap attempts globally', () => {
  const config = parseServerConfig({ GEMINI_OPERATION_BUDGET_MS: '999999', GEMINI_TIMEOUT_MS: '999999', GEMINI_MAX_ATTEMPTS: '999' });
  assert.equal(config.geminiOperationBudgetMs, 100_000);
  assert.equal(config.geminiTimeoutMs, 60_000);
  assert.equal(config.geminiMaxAttempts, 3);
  assert.equal(parseServerConfig({}).geminiOperationBudgetMs, 90_000);
  assert.equal(parseServerConfig({}).geminiMaxAttempts, 2);
  assert.equal(parseServerConfig({ GEMINI_RUNTIME_PROFILE: 'standard' }).geminiRuntimeProfile, 'standard');
  assert.throws(() => parseServerConfig({ GEMINI_RUNTIME_PROFILE: 'paid-magic' }));
});

test('503 attempts are globally bounded across every fallback model', async () => {
  const calls: string[] = [];
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, request: async model => { calls.push(model); throw { status: 503 }; } }), 'AI_TEMPORARILY_UNAVAILABLE');
  assert.deepEqual(calls, ['primary', 'fallback']);
});

test('monotonic remaining budget caps the second model and refuses late success', async () => {
  let clock = 0; const timeouts: number[] = [];
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, now: () => clock,
    request: async (_m, timeout) => { timeouts.push(timeout); clock += 50; if (timeouts.length === 1) throw { status: 503 }; return ok; } }), 'AI_DEADLINE_EXCEEDED');
  assert.deepEqual(timeouts, [50, 40]);
});

test('deadline exhaustion never dispatches another model', async () => {
  let clock = 0, calls = 0;
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, now: () => clock,
    request: async () => { calls++; clock = 90; throw { status: 503 }; } }), 'AI_DEADLINE_EXCEEDED');
  assert.equal(calls, 1);
});
test('time spent receiving and validating the request reduces the provider operation budget', async () => {
  let clock = 60; let timeout = 0;
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, now: () => clock, operationDeadline: 90,
    request: async (_m, t) => { timeout = t; clock = 91; return ok; } }), 'AI_DEADLINE_EXCEEDED');
  assert.equal(timeout, 30);
});

test('hung provider is interrupted and can use one alternative within the deadline', async () => {
  let calls = 0; let signal: AbortSignal | undefined;
  const result = await executeGeminiJsonWithModelFallback({ ...base, request: async (_m, _t, _a, s) => {
    if (++calls === 1) { signal = s; return new Promise(() => {}); } return ok;
  } });
  assert.equal(result, true); assert.equal(calls, 2); assert.equal(signal?.aborted, true);
});

test('temporary 429 observes Retry-After and daily quota never falls back', async () => {
  const temporary = normalizeGeminiFailure({ status: 429, headers: { 'retry-after': '2' } });
  assert.equal(temporary.retryable, true); assert.equal(temporary.retryAfterMs, 2000);
  const daily = normalizeGeminiFailure({ status: 429, message: JSON.stringify({ error: { details: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] } }) });
  assert.equal(daily.code, 'AI_QUOTA_EXHAUSTED'); assert.equal(daily.retryable, false);
  let calls = 0;
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, request: async () => { calls++; throw { status: 429, headers: { 'retry-after': '2' } }; } }), 'AI_RATE_LIMITED');
  assert.equal(calls, 1); // Do not shorten provider guidance to fit a smaller deadline.
});

test('network drops, auth, schema errors and policy blocks remain distinguishable', async () => {
  assert.equal(normalizeGeminiFailure({ status: 504 }).code, 'AI_TIMEOUT');
  assert.equal(normalizeGeminiFailure(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })).code, 'AI_NETWORK_ERROR');
  assert.equal(normalizeGeminiFailure({ status: 400, message: 'quota invalid request' }).code, 'AI_REQUEST_FAILED');
  for (const error of [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }, { message: 'SAFETY block' }]) {
    let calls = 0;
    await assert.rejects(executeGeminiJsonWithModelFallback({ ...base, request: async () => { calls++; throw error; } }));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, request: async () => { calls++; return { text: '{"ok":false}' }; } }), 'AI_INVALID_RESPONSE');
  assert.equal(calls, 1);
});

test('explicit cancellation interrupts provider and backoff, rejecting all late responses', async () => {
  for (const inBackoff of [false, true]) {
    const controller = new AbortController(); let calls = 0;
    const pending = executeGeminiJsonWithModelFallback({ ...base, operationBudgetMs: 1000, retryDelayMs: 100,
      signal: controller.signal, request: async () => { calls++; if (inBackoff) throw { status: 503 }; return new Promise(resolve => setTimeout(() => resolve(ok), 30)); } });
    const assertion = rejectsCode(pending, 'AI_CANCELLED');
    await new Promise(resolve => setTimeout(resolve, 5)); controller.abort(); await assertion;
    assert.equal(calls, 1);
  }
});
