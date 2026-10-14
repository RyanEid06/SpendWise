import test from 'node:test';
import assert from 'node:assert/strict';
import { executeGeminiJsonWithModelFallback, type AttemptEvent } from '../server/geminiReliability';
import { parseServerConfig } from '../server/config';
import { GeminiService } from '../server/services/GeminiService';

const base = {
  endpoint: '/api/gemini/analyze', requestId: 'wp38-synthetic',
  models: ['primary', 'verified-alternate'], recoverInvalidResponse: true,
  timeoutMs: 1000, operationBudgetMs: 2000, minAttemptBudgetMs: 5,
  retryDelayMs: 0, random: () => 0, maxAttempts: 2,
  validate: (value: unknown) => (value as { ok?: unknown })?.ok === true ? true : null,
};
const ok = { text: '{"ok":true}' };
const rejectsCode = (work: Promise<unknown>, code: string) => assert.rejects(work, (error: any) => error.code === code);

for (const invalid of ['{bad json', '{"ok":false}']) {
  test(`invalid output ${invalid} recovers once on a qualified distinct alternate with truthful telemetry`, async () => {
    const calls: string[] = [], events: AttemptEvent[] = [], fallbacks: unknown[] = [];
    const result = await executeGeminiJsonWithModelFallback({ ...base,
      logAttempt: event => events.push(event), logModelFallback: event => fallbacks.push(event),
      request: async model => { calls.push(model); return calls.length === 1 ? { text: invalid } : ok; },
    });
    assert.equal(result, true);
    assert.deepEqual(calls, ['primary', 'verified-alternate']);
    assert.deepEqual(events.map(e => [e.code, e.willRetry, e.fallbackUsed]), [
      ['AI_INVALID_RESPONSE', true, false], ['PROVIDER_SUCCESS', false, true],
    ]);
    assert.deepEqual(fallbacks, [{ endpoint: base.endpoint, requestId: base.requestId,
      fromModel: 'primary', toModel: 'verified-alternate', code: 'AI_INVALID_RESPONSE' }]);
  });
}

test('invalid output cannot recover without verified opt-in, a distinct alternate, or attempt capacity', async () => {
  for (const options of [{ recoverInvalidResponse: false }, { models: ['primary', 'primary'] }, { maxAttempts: 1 }]) {
    let calls = 0;
    await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, ...options,
      request: async () => { calls++; return { text: '{}' }; },
    }), 'AI_INVALID_RESPONSE');
    assert.equal(calls, 1);
  }
});

test('invalid recovery never opens a third attempt even with a larger configured transient cap', async () => {
  for (const second of ['invalid', 'transient']) {
    const calls: string[] = [];
    await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, maxAttempts: 3, models: ['primary', 'verified-alternate', 'third'],
      request: async model => { calls.push(model); if (calls.length === 2 && second === 'transient') throw { status: 503 }; return { text: '{}' }; },
    }), second === 'invalid' ? 'AI_INVALID_RESPONSE' : 'AI_TEMPORARILY_UNAVAILABLE');
    assert.deepEqual(calls, ['primary', 'verified-alternate']);
  }
});

test('invalid output cannot dispatch an alternate with insufficient or expired deadline budget', async () => {
  for (const consumed of [1996, 2000]) {
    let clock = 0, calls = 0;
    await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, now: () => clock,
      request: async () => { calls++; clock = consumed; return { text: '{}' }; },
    }), consumed === 2000 ? 'AI_DEADLINE_EXCEEDED' : 'AI_INVALID_RESPONSE');
    assert.equal(calls, 1);
  }
});

test('safety refusal, permanent auth/config failure, daily quota and cancellation never recover', async () => {
  for (const failure of ['safety', 'auth', 'quota', 'cancelled']) {
    let calls = 0;
    const controller = new AbortController();
    await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, signal: controller.signal,
      request: async () => {
        calls++;
        if (failure === 'safety') return { ...ok, promptFeedback: { blockReason: 'SAFETY' } };
        if (failure === 'auth') throw { status: 401 };
        if (failure === 'quota') throw { status: 429, message: 'daily quota exhausted' };
        controller.abort(); return { text: '{}' };
      },
    }), { safety: 'AI_CONTENT_BLOCKED', auth: 'AI_REQUEST_FAILED', quota: 'AI_QUOTA_EXHAUSTED', cancelled: 'AI_CANCELLED' }[failure]!);
    assert.equal(calls, 1);
  }
  await rejectsCode(executeGeminiJsonWithModelFallback({ ...base, models: [], request: async () => ok }), 'AI_NOT_CONFIGURED');
});

test('qualified defaults retain four distinct low-thinking routes and existing budgets', () => {
  const config = parseServerConfig({});
  assert.deepEqual(Object.keys(config.geminiTaskRoutes).sort(), ['analyze', 'explain-trends', 'scan-receipt', 'smart-capture']);
  for (const route of Object.values(config.geminiTaskRoutes)) {
    assert.deepEqual(route, { models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'], thinkingLevel: 'low' });
  }
  assert.equal(config.geminiOperationBudgetMs, 90_000);
  assert.equal(config.geminiTimeoutMs, 50_000);
  assert.equal(config.geminiMaxAttempts, 2);
});

for (const endpoint of ['analyze', 'explain-trends', 'smart-capture', 'scan-receipt']) {
  test(`${endpoint}: actual service opts qualified routes into strict invalid-output recovery`, async () => {
    const service = new GeminiService(); const models: string[] = [];
    (service as any).createClient = () => ({ models: { generateContent: async (request: { model: string }) => {
      models.push(request.model); return models.length === 1 ? { text: '{bad json' } : ok;
    } } });
    const result = await service.generateJson({ endpoint: `/api/gemini/${endpoint}`, requestId: 'wp38-synthetic',
      contents: 'synthetic', systemInstruction: 'synthetic',
      responseJsonSchema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
      validate: base.validate,
    });
    assert.equal(result, true);
    assert.deepEqual(models, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  });
}
