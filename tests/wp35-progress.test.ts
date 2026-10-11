import assert from 'node:assert/strict';
import test from 'node:test';
import { AiOperationController, stageFromRecoveryPhase } from '../src/app/hooks/aiOperation';

test('progress changes only on explicit signals, never with elapsed time', () => {
  const operation = new AiOperationController();
  const run = operation.begin('preparing')!;
  assert.equal(operation.getSnapshot().stage, 'preparing');
  run.stage('sending');
  assert.equal(operation.getSnapshot().stage, 'sending');
  run.stage('checking');
  run.finish('ready');
  assert.equal(operation.getSnapshot().stage, 'ready');
  assert.equal(operation.getSnapshot().active, false);
});

test('Cancel invalidates before abort; late callbacks cannot replace a retry', () => {
  const operation = new AiOperationController();
  const old = operation.begin()!;
  let validDuringAbort = true;
  old.signal.addEventListener('abort', () => { validDuringAbort = old.isCurrent(); });
  operation.cancel();
  assert.equal(validDuringAbort, false);
  assert.equal(operation.getSnapshot().stage, 'cancelled');
  const retry = operation.begin()!;
  old.stage('checking');
  old.finish('ready');
  assert.equal(retry.isCurrent(), true);
  assert.equal(operation.getSnapshot().stage, 'starting');
  retry.finish('local');
  assert.equal(operation.getSnapshot().stage, 'local');
});

test('duplicate submission is refused until completion or cancel', () => {
  const operation = new AiOperationController();
  const first = operation.begin()!;
  assert.equal(operation.begin(), null);
  first.finish('error');
  assert.notEqual(operation.begin(), null);
});

test('reset aborts work and rejects late results without emitting cancellation UI', () => {
  const operation = new AiOperationController();
  const run = operation.begin()!;
  operation.reset();
  assert.equal(run.signal.aborted, true);
  assert.equal(run.isCurrent(), false);
  assert.equal(operation.getSnapshot().stage, 'idle');
});

test('only observed readiness/auth/dispatch starts map to stages', () => {
  assert.equal(stageFromRecoveryPhase({ phase: 'readiness', outcome: 'start' }), 'connecting');
  assert.equal(stageFromRecoveryPhase({ phase: 'verify', outcome: 'start' }), 'authenticating');
  assert.equal(stageFromRecoveryPhase({ phase: 'ai_dispatch', outcome: 'start' }), 'sending');
  assert.equal(stageFromRecoveryPhase({ phase: 'verify', outcome: 'success' }), null);
  assert.equal(stageFromRecoveryPhase({ phase: 'model_retry', outcome: 'start' }), null);
});

test('a simulated 65s readiness wait does not advance to auth or model activity by time', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const operation = new AiOperationController();
  const run = operation.begin()!;
  run.onPhase({ phase: 'readiness', outcome: 'start' });
  t.mock.timers.tick(65_000);
  assert.equal(operation.getSnapshot().stage, 'connecting');
  run.onPhase({ phase: 'readiness', outcome: 'success' });
  assert.equal(operation.getSnapshot().stage, 'connecting');
  run.onPhase({ phase: 'challenge', outcome: 'start' });
  assert.equal(operation.getSnapshot().stage, 'authenticating');
  operation.cancel();
  run.onPhase({ phase: 'ai_dispatch', outcome: 'start' });
  assert.equal(operation.getSnapshot().stage, 'cancelled');
});
