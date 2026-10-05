import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
import { createSyntheticLedger, createSyntheticMedia, createRestoreHarness, FIXTURE_CLOCK, FIXTURE_SEED } from './fixtures';
import { measureOperation, withBenchmarkClock, type OperationMeasurement } from './measure';
import { createBackupV2Archive, validateBackupV2Archive } from '../../src/utils/backupV2';
import { createBackupV3Envelope, decryptBackupV3Envelope, restoreBackupV3WithAdapters } from '../../src/utils/backupV3';

/** Archive workload reuses the existing synthetic JPEG. No image decoding or native disk claim. */
export async function runFullMediaBenchmark(samples = 5, warmups = 1) {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('BENCHMARK_REQUIRES_NODE_22');
  const bytes = await readFile(new URL('../../tests/fixtures/media/wp32-photo-01.jpg', import.meta.url));
  const state = createSyntheticLedger(100);
  state.attachments = createSyntheticMedia(state, 32).attachments.map((item) => ({ ...item, byteSize: bytes.length, width: 1024, height: 1024 }));
  const settings = { currencyCode: 'USD', language: 'en', themeMode: 'SYSTEM' } as const;
  const passphrase = 'WP33 synthetic full-media passphrase';
  const generatedAt = new Date().toISOString();
  return withBenchmarkClock(FIXTURE_CLOCK, async () => {
    const payload = () => createBackupV2Archive({ appVersion: '2.0.0', state, settings, includeMedia: true, readMedia: async () => new Blob([bytes], { type: 'image/jpeg' }) });
    const inner = await payload();
    const archive = await createBackupV3Envelope({ payload: inner, passphrase, mediaIncluded: true });
    const operations: OperationMeasurement[] = [];
    operations.push(await measureOperation('backup.full.create', async () => createBackupV3Envelope({ payload: await payload(), passphrase, mediaIncluded: true }), (value) => assert.ok(value.size > bytes.length * 32), samples, warmups));
    operations.push(await measureOperation('backup.full.decrypt', () => decryptBackupV3Envelope(archive, passphrase), (value) => assert.equal(value.size, inner.size), samples, warmups));
    operations.push(await measureOperation('backup.full.validate', () => validateBackupV2Archive(inner), (value) => { assert.equal(value.manifest.mediaIncluded, true); assert.equal(value.manifest.counts.mediaFiles, 32); assert.equal(value.manifest.counts.mediaBytes, bytes.length * 32); }, samples, warmups));
    operations.push(await measureOperation('backup.full.restore', async () => {
      const harness = createRestoreHarness(createSyntheticLedger(0));
      const blobs: { sourceId: string; expenseId: number; blob: Blob }[] = [];
      const stage = harness.adapters.stageMedia;
      harness.adapters.stageMedia = async (source, expenseId, blob) => { blobs.push({ sourceId: source.id, expenseId, blob }); return stage(source, expenseId, blob); };
      const summary = await restoreBackupV3WithAdapters(archive, passphrase, true, harness.adapters);
      // Byte materialization belongs to the archive/adapter restore workload.
      const restoredBytes = await Promise.all(blobs.map(async (item) => ({ ...item, bytes: Buffer.from(await item.blob.arrayBuffer()) })));
      return { summary, restoredBytes, state: harness.getState() };
    }, (value) => {
      assert.deepEqual(value.state.expenses, state.expenses); assert.deepEqual(value.state.budgets, state.budgets);
      assert.equal(value.state.currencyCode, state.currencyCode); assert.equal(value.state.attachments.length, 32); assert.equal(value.restoredBytes.length, 32);
      for (const source of state.attachments) {
        const restored = value.state.attachments.find((item) => item.id === `wp33-restored-${source.id}`)!;
        assert.ok(restored); assert.equal(restored.expenseId, source.expenseId); assert.equal(restored.byteSize, source.byteSize);
        for (const key of ['kind', 'createdAt', 'width', 'height', 'mimeType'] as const) assert.equal(restored[key], source[key]);
        const binary = value.restoredBytes.find((item) => item.sourceId === source.id)!;
        assert.equal(binary.expenseId, source.expenseId); assert.deepEqual(binary.bytes, bytes);
      }
    }, samples, warmups));
    const cpu = cpus();
    return { format: 'spendwise-full-media-benchmark-v1' as const, generatedAt, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      environment: { nodeVersion: process.versions.node, platform: platform(), arch: arch(), cpu: cpu[0]?.model ?? 'unknown', cpuCount: cpu.length, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, mode: 'production-crypto-isolated-memory-media-adapter' },
      fixture: { expenses: 100, attachments: 32, mediaBytes: bytes.length * 32, seed: FIXTURE_SEED, clockTimestamp: FIXTURE_CLOCK, image: 'existing-wp32-synthetic-jpeg' }, archiveBytes: archive.size, operations,
      correctness: { restoredAttachments: 32, byteEquivalent: true as const } };
  });
}
