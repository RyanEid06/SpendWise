import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiReliabilityError,
  cleanupRateBuckets,
  executeGeminiJson,
  executeGeminiJsonWithModelFallback,
  normalizeGeminiFailure,
} from '../server/geminiReliability';
import { classifyApiFailure } from '../src/utils/apiErrors';

test('classifies provider 5xx and temporary rate limits as eligible for bounded retry', () => {
  assert.equal(normalizeGeminiFailure({ status: 503 }).code, 'AI_TEMPORARILY_UNAVAILABLE');
  assert.equal(normalizeGeminiFailure({ status: 503 }).retryable, true);
  assert.equal(normalizeGeminiFailure({ status: 429 }).code, 'AI_RATE_LIMITED');
  assert.equal(normalizeGeminiFailure({ status: 429 }).retryable, true);
});

test('normalizes timeouts as eligible only for the bounded shared retry loop', () => {
  const error = new Error('request timed out');
  const failure = normalizeGeminiFailure(error);
  assert.equal(failure.code, 'AI_TIMEOUT');
  assert.equal(failure.retryable, true);
});

test('retries one transient failure and then succeeds', async () => {
  let attempts = 0;
  const result = await executeGeminiJson({
    endpoint: '/test',
    requestId: 'request-1',
    timeoutMs: 1000,
    retryDelayMs: 0,
    request: async () => {
      attempts += 1;
      if (attempts === 1) throw { status: 503 };
      return { text: '{"ok":true}' };
    },
    validate: (value) =>
      value && typeof value === 'object' && (value as Record<string, unknown>).ok === true
        ? true
        : null,
  });

  assert.equal(result, true);
  assert.equal(attempts, 2);
});

test('does not retry malformed JSON', async () => {
  let attempts = 0;

  await assert.rejects(
    executeGeminiJson({
      endpoint: '/test',
      requestId: 'request-2',
      timeoutMs: 1000,
      retryDelayMs: 0,
      request: async () => {
        attempts += 1;
        return { text: 'not-json' };
      },
      validate: () => null,
    }),
    (error: unknown) =>
      error instanceof AiReliabilityError && error.code === 'AI_INVALID_RESPONSE'
  );

  assert.equal(attempts, 1);
});

test('cleans expired rate-limit buckets and bounds map size', () => {
  const buckets = new Map<string, { resetAt: number }>([
    ['expired', { resetAt: 10 }],
    ['old', { resetAt: 200 }],
    ['new', { resetAt: 300 }],
  ]);

  const removed = cleanupRateBuckets(buckets, 100, 1);

  assert.equal(removed, 2);
  assert.deepEqual([...buckets.keys()], ['new']);
});

test('frontend error classifier maps stable backend contract', () => {
  assert.equal(classifyApiFailure(504, 'AI_TIMEOUT'), 'timeout');
  assert.equal(classifyApiFailure(429, 'AI_RATE_LIMITED'), 'rate_limited');
  assert.equal(classifyApiFailure(503, 'AI_NOT_CONFIGURED'), 'not_configured');
  assert.equal(classifyApiFailure(502, 'AI_INVALID_RESPONSE'), 'invalid_response');
  assert.equal(classifyApiFailure(503, 'AI_TEMPORARILY_UNAVAILABLE'), 'temporary_unavailable');
});


test('falls back to the secondary model only after transient provider unavailability', async () => {
  const models: string[] = [];
  const result = await executeGeminiJsonWithModelFallback({
    endpoint: '/test-fallback',
    requestId: 'request-fallback',
    models: ['primary-model', 'fallback-model'],
    timeoutMs: 1000,
    retryDelayMs: 0,
    request: async (model) => {
      models.push(model);
      if (model === 'primary-model') throw { status: 503 };
      return { text: '{"ok":true}' };
    },
    validate: (value) =>
      value && typeof value === 'object' && (value as Record<string, unknown>).ok === true
        ? true
        : null,
  });

  assert.equal(result, true);
  assert.deepEqual(models, ['primary-model', 'fallback-model']);
});

test('falls back across models on rate limits and surfaces 429 only after all are exhausted', async () => {
  const models: string[] = [];

  await assert.rejects(
    executeGeminiJsonWithModelFallback({
      endpoint: '/test-rate-limit-fallback',
      requestId: 'request-rate-limit-fallback',
      models: ['primary-model', 'fallback-model'],
      timeoutMs: 1000,
      retryDelayMs: 0,
      request: async (model) => {
        models.push(model);
        throw { status: 429 };
      },
      validate: () => true,
    }),
    (error: unknown) =>
      error instanceof AiReliabilityError && error.code === 'AI_RATE_LIMITED'
  );

  assert.deepEqual(models, ['primary-model', 'fallback-model']);
});
