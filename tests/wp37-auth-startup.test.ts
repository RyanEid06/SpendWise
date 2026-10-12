import test from 'node:test';
import assert from 'node:assert/strict';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

async function fixture(native = true) {
  const module = await import('../src/security/SecurityLifecycleCoordinator').catch(() => null);
  assert.ok(module, 'bootstrap and AppShell share a continuous security lifecycle coordinator');
  const session = {
    revision: 0, locked: false, backgroundedAt: 0, backgroundCalls: [] as number[],
    async onNativeBackground(now: number) { this.onBackground(now); },
    onBackground(now: number) { this.backgroundCalls.push(now); this.backgroundedAt = now; },
    onForeground(now: number) { if (now - this.backgroundedAt >= 60_000) this.lock(); this.backgroundedAt = 0; return this.locked; },
    lock() { this.locked = true; this.revision++; },
    getSnapshot() { return { state: this.locked ? 'locked' : 'unlocked', sessionRevision: this.revision, appLockEnabled: true }; },
  };
  return { module, session, lifecycle: new module.SecurityLifecycleCoordinator(session as any, native) };
}

test('WP37 bootstrap timeout during pending protected storage cannot render Home', async () => {
  const { lifecycle, session, module } = await fixture();
  const revision = session.revision;
  const storage = deferred();
  const opening = (async () => {
    await storage.promise;
    await lifecycle.waitUntilForeground();
    return module.canEnterProtectedApplication(revision, session.getSnapshot() as any);
  })();
  lifecycle.background(1_000);
  storage.resolve();
  lifecycle.foreground(61_000);
  assert.equal(await opening, false);
  assert.equal(session.locked, true);
});

test('WP37 completed startup storage remains hidden until foreground within timeout', async () => {
  const { lifecycle, session, module } = await fixture();
  lifecycle.background(1_000);
  let rendered = false;
  const ready = lifecycle.waitUntilForeground().then(() => {
    rendered = module.canEnterProtectedApplication(0, session.getSnapshot() as any);
  });
  await Promise.resolve();
  assert.equal(rendered, false);
  lifecycle.foreground(2_000);
  await ready;
  assert.equal(rendered, true);
});

test('WP37 queued lifecycle classification preserves original event timestamps', async () => {
  const { lifecycle, session } = await fixture();
  const classification = deferred();
  session.onNativeBackground = async (now: number) => { await classification.promise; session.onBackground(now); };
  lifecycle.background(1_000);
  lifecycle.foreground(61_000);
  classification.resolve();
  await lifecycle.waitUntilForeground();
  assert.deepEqual(session.backgroundCalls, [1_000]);
  assert.equal(session.locked, true);
});

test('WP37 a changed lock revision rejects an old bootstrap entry even after a later unlock', async () => {
  const { module, session } = await fixture(false);
  session.lock();
  session.locked = false;
  assert.equal(module.canEnterProtectedApplication(0, session.getSnapshot() as any), false);
});
