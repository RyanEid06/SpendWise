import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { boundedLog } from '../server/observability/safeLogging';
import { parseTaskRoutes } from '../server/taskRouting';
import { OperationalAggregates } from '../server/observability/aggregates';
import { aiOperationContext } from '../server/middleware/aiOperationContext';
import { GeminiService } from '../server/services/GeminiService';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serverConfig } from '../server/config';
import { boundedAiJsonBody } from '../server/middleware/requestLimits';
import { apiErrorHandler } from '../server/middleware/errors';

test('ingress deadline returns a stable failure and closes a stalled partial upload before dispatch', async t => {
  const oldBudget = serverConfig.geminiOperationBudgetMs;
  serverConfig.geminiOperationBudgetMs = 25;
  let dispatches = 0; let incoming: any;
  const app = express();
  app.use((req, _res, next) => { incoming = req; next(); });
  app.use(aiOperationContext, boundedAiJsonBody);
  app.post('/api/gemini/analyze', (_req, res) => { dispatches++; res.json({ ok: true }); });
  app.use(apiErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { serverConfig.geminiOperationBudgetMs = oldBudget; server.closeAllConnections(); server.close(); });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const result = await new Promise<{ status: number | undefined; body: any }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: (server.address() as AddressInfo).port, path: '/api/gemini/analyze', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '1000000' } }, res => {
      let body = ''; res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    t.after(() => req.destroy()); req.on('error', reject);
    req.setTimeout(1000, () => req.destroy(new Error('Stalled ingress exceeded test bound')));
    req.write('{"synthetic":'); // Deliberately leave the authenticated-route parser waiting for EOF.
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.status, 504); assert.equal(result.body.error, 'AI_DEADLINE_EXCEEDED');
  assert.equal(incoming.destroyed, true); assert.equal(dispatches, 0);
});

test('task routes require verified models and explicit quality approval for all four features', () => {
  const routes = Object.fromEntries(['smart-capture', 'scan-receipt', 'analyze', 'explain-trends'].map(t => [t, { models: ['gemini-3.8-flash'], thinkingLevel: 'low' }]));
  const env = { GEMINI_TASK_ROUTES: JSON.stringify(routes), GEMINI_VERIFIED_MODELS: 'gemini-3.8-flash', GEMINI_ROUTING_QUALITY_APPROVED: 'true' };
  assert.equal(Object.keys(parseTaskRoutes(env)).length, 4);
  assert.deepEqual(parseTaskRoutes({}), {});
  assert.throws(() => parseTaskRoutes({ ...env, GEMINI_VERIFIED_MODELS: '' }));
  assert.throws(() => parseTaskRoutes({ ...env, GEMINI_ROUTING_QUALITY_APPROVED: '' }));
  assert.throws(() => parseTaskRoutes({ ...env, GEMINI_VERIFIED_MODELS: 'gemini-3.1-flash-lite-image', GEMINI_TASK_ROUTES: JSON.stringify({ analyze: { models: ['gemini-3.1-flash-lite-image'], thinkingLevel: 'low' } }) }));
});
test('provider diagnostics retain bounded metadata only, including status and token usage', () => {
  const logs: any[] = [];
  const requestId = 'd0af7161-d7a2-4a27-8565-20abc1f766f0';
  boundedLog('AI', { endpoint: '/api/gemini/analyze', requestId, model: 'gemini-3.8-flash', code: 'AI_NETWORK_ERROR', attempt: 3,
    attemptMs: 500, remainingMs: 85000, retryDelayMs: 2000, upstreamStatus: 503, networkClass: 'ECONNRESET', promptTokens: 100, outputTokens: 50, thinkingTokens: 25,
    apiKey: 'private-key', prompt: 'private-expense', image: 'private-image', signature: 'private-signature' }, v => logs.push(v));
  assert.equal(logs[0].requestId, requestId); assert.equal(logs[0].attempt, 3);
  assert.equal(logs[0].code, 'AI_NETWORK_ERROR'); assert.equal(logs[0].model, 'gemini-3.8-flash');
  assert.equal(logs[0].networkClass, 'ECONNRESET'); assert.equal(logs[0].upstreamStatus, 503); assert.equal(logs[0].promptTokens, 100);
  assert.ok(!JSON.stringify(logs).includes('private'));
  boundedLog('AI', { model: 'private-key', networkClass: 'private-host', upstreamStatus: Infinity, promptTokens: -1 }, v => logs.push(v));
  assert.ok(!JSON.stringify(logs).includes('private'));
});
test('aggregate quota ceiling reports the global attempt cap, independent of fallback list length', () => {
  const metrics = new OperationalAggregates({ dailyAdmissionLimit: 5000, modelCount: 151, maxAttempts: 2 });
  assert.equal(metrics.snapshot().useBounds.maxAttemptsPerAdmission, 2);
  assert.equal(metrics.snapshot().useBounds.theoreticalDailyAttemptCeiling, 10000);
});
test('client disconnect propagates cancellation and preserves WP35.1 correlation context', () => {
  const res: any = new EventEmitter(); res.locals = { requestId: 'd0af7161-d7a2-4a27-8565-20abc1f766f0' }; res.setHeader = () => {}; res.writableFinished = false;
  aiOperationContext({ header: () => 'untrusted', originalUrl: '/api/gemini/analyze' } as any, res, () => {});
  assert.equal(res.locals.requestId, 'd0af7161-d7a2-4a27-8565-20abc1f766f0');
  res.emit('close'); assert.equal(res.locals.aiSignal.aborted, true);
  assert.equal(res.listenerCount('close'), 0); assert.equal(res.listenerCount('finish'), 0);
});
test('actual service rejects structurally invalid JSON before route sanitization without retry', async () => {
  const service = new GeminiService(); let calls = 0;
  (service as any).createClient = () => ({ models: { generateContent: async () => { calls++; return { text: '{}' }; } } });
  await assert.rejects(service.generateJson({ endpoint: '/api/gemini/analyze', requestId: 'test', contents: 'synthetic', systemInstruction: 'synthetic',
    responseJsonSchema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } }, validate: v => v }), (e: any) => e.code === 'AI_INVALID_RESPONSE');
  assert.equal(calls, 1);
});
test('installed SDK preserves provider Retry-After through the service without hidden retries', async t => {
  const service = new GeminiService(); let calls = 0;
  (service as any).createClient = () => new GoogleGenAI({ apiKey: 'synthetic-test-key' });
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }, { status: 429, headers: { 'Retry-After': '200' } }); });
  await assert.rejects(service.generateJson({ endpoint: '/api/gemini/analyze', requestId: 'test', contents: 'synthetic', systemInstruction: 'synthetic', responseJsonSchema: { type: 'object' }, validate: v => v }), (e: any) => e.code === 'AI_RATE_LIMITED' && e.upstreamStatus === 429 && e.retryAfterMs === 200000);
  assert.equal(calls, 1);
});
test('installed SDK receives explicit cancellation and the service rejects late transport output', async t => {
  const service = new GeminiService(); let transportSignal: AbortSignal | undefined;
  (service as any).createClient = () => new GoogleGenAI({ apiKey: 'synthetic-test-key' });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { transportSignal = init.signal ?? undefined; return new Promise(() => {}); });
  const controller = new AbortController();
  const assertion = assert.rejects(service.generateJson({ endpoint: '/api/gemini/analyze', requestId: 'test', contents: 'synthetic', systemInstruction: 'synthetic', responseJsonSchema: { type: 'object' }, validate: v => v, signal: controller.signal }), (e: any) => e.code === 'AI_CANCELLED');
  await new Promise(resolve => setTimeout(resolve, 10)); controller.abort(); await assertion;
  assert.equal(transportSignal?.aborted, true);
});
