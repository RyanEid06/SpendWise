import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { boundedLog } from '../server/observability/safeLogging';
import { observeApiRequests } from '../server/observability/requestObservability';
import { OperationalAggregates } from '../server/observability/aggregates';
import { aiRequestId } from '../server/logging/aiLogging';

test('provider attempts reuse the validated HTTP operation correlation', () => {
  const id = 'a2cff8bc-3eb0-46d5-9e36-57efa05fc833';
  assert.equal(aiRequestId(id), id);
  assert.match(aiRequestId('private-token'), /^[a-f0-9-]{36}$/);
  assert.notEqual(aiRequestId('private-token'), 'private-token');
});

test('phase logs accept only UUID correlation and finite status vocabulary', () => {
  const logs: any[] = [];
  boundedLog('API', { requestId: 'a2cff8bc-3eb0-46d5-9e36-57efa05fc833', phase: 'challenge', outcome: 'failure', code: 'AUTH_STORE_UNAVAILABLE', route: '/api/auth/challenge', elapsedMs: 50, installationId: 'private-id', signature: 'private-signature' }, e => logs.push(e), () => 900_000);
  assert.equal(logs[0].requestId, 'a2cff8bc-3eb0-46d5-9e36-57efa05fc833');
  assert.equal(logs[0].phase, 'challenge');
  assert.equal(logs[0].code, 'AUTH_STORE_UNAVAILABLE');
  boundedLog('API', { requestId: 'secret-token', phase: 'secret-prompt', outcome: 'secret-key', route: '/api/health' }, e => logs.push(e), () => 900_001);
  assert.doesNotMatch(JSON.stringify(logs), /private-|secret-/);
});

test('request correlation is returned and reused; disconnect produces sanitized phase event', () => {
  const logs: any[] = [];
  const req: any = { originalUrl: '/api/auth/challenge?private-prompt', header: () => 'a2cff8bc-3eb0-46d5-9e36-57efa05fc833' };
  const headers: Record<string, string> = {};
  const res: any = Object.assign(new EventEmitter(), { statusCode: 200, writableFinished: false, locals: {}, setHeader: (key: string, value: string) => { headers[key] = value; }, json: (body: any) => body });
  observeApiRequests(new OperationalAggregates(), e => logs.push(e))(req, res, () => {});
  res.emit('close'); res.emit('finish');
  assert.equal(headers['X-Request-ID'], req.header());
  assert.equal(logs.filter(e => e.phase === 'client_disconnect').length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /private-prompt/);
});
