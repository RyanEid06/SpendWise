import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DiagnosticStore, DIAGNOSTIC_STORAGE_KEY } from '../../src/services/diagnostics/DiagnosticStore';

export function assertSyntheticEmulator(input: { serial: string; qemu: string; avd: string }): void {
  if (!/^emulator-\d+$/.test(input.serial) || input.qemu.trim() !== '1' || !/^wp33-synthetic(?:-[A-Za-z0-9_-]+)?$/.test(input.avd.trim())) throw new Error('SYNTHETIC_EMULATOR_REQUIRED');
}

/** Collect actual instrumented SQLCipher open/read timings from a disposable debug emulator. */
async function collectNativeBenchmark(output: string): Promise<void> {
  const serial = process.env.ADB_SERIAL ?? '';
  if (process.env.WP33_NATIVE_FIXTURE !== 'wp32-v2-full') throw new Error('SYNTHETIC_FIXTURE_RECEIPT_REQUIRED');
  if (!/^emulator-\d+$/.test(serial)) throw new Error('SYNTHETIC_EMULATOR_REQUIRED: set ADB_SERIAL to the dedicated wp33-synthetic emulator.');
  const adbPath = process.env.ADB_BINARY ?? 'adb';
  const adb = (...args: string[]) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
  const avd = adb('emu', 'avd', 'name').split(/\r?\n/)[0];
  assertSyntheticEmulator({ serial, qemu: adb('shell', 'getprop', 'ro.kernel.qemu'), avd });
  // run-as proves this is a debuggable installation before any lifecycle change.
  adb('shell', 'run-as', 'com.spendwise.app', 'pwd');
  const apiLevel = Number(adb('shell', 'getprop', 'ro.build.version.sdk').trim());
  if (!Number.isInteger(apiLevel) || apiLevel < 24 || apiLevel > 100) throw new Error('INVALID_EMULATOR_API_LEVEL');
  const port = 9223;
  let socket: WebSocket | undefined;
  let nextId = 0;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const disconnect = () => { socket?.close(); socket = undefined; for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('NATIVE_PROBE_DISCONNECTED')); } pending.clear(); };
  const connect = async () => {
    disconnect();
    const pid = adb('shell', 'pidof', 'com.spendwise.app').trim().split(' ')[0];
    if (!/^\d+$/.test(pid)) throw new Error('NATIVE_APP_NOT_RUNNING');
    adb('forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`);
    const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) });
    const targets = await response.json() as { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find((item) => item.type === 'page');
    if (!target || !target.webSocketDebuggerUrl.startsWith(`ws://127.0.0.1:${port}/`)) throw new Error('NATIVE_DEBUG_WEBVIEW_UNAVAILABLE');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error('NATIVE_PROBE_TIMEOUT')), 5000);
      socket!.addEventListener('open', () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket!.addEventListener('error', () => { clearTimeout(timer); rejectOpen(new Error('NATIVE_PROBE_CONNECTION_FAILED')); }, { once: true });
    });
    socket.addEventListener('message', (event) => {
      const response = JSON.parse(String(event.data)); const entry = pending.get(response.id); if (!entry) return;
      pending.delete(response.id); clearTimeout(entry.timer);
      if (response.error) entry.reject(new Error('NATIVE_PROBE_EVALUATION_FAILED')); else entry.resolve(response.result);
    });
  };
  const evaluate = (expression: string) => new Promise<any>((resolveValue, rejectValue) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); rejectValue(new Error('NATIVE_PROBE_TIMEOUT')); }, 5000);
    pending.set(id, { resolve: resolveValue, reject: rejectValue, timer });
    socket!.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  const readReport = async () => {
    const evaluated = await evaluate(`localStorage.getItem(${JSON.stringify(DIAGNOSTIC_STORAGE_KEY)})`);
    if (evaluated.exceptionDetails) throw new Error('NATIVE_REPORT_UNAVAILABLE');
    const raw = typeof evaluated.result?.value === 'string' ? evaluated.result.value : null;
    // Reuse the production runtime allowlist; raw WebView strings are never written or printed.
    return new DiagnosticStore({ getItem: () => raw, setItem: () => {}, removeItem: () => {} }).report();
  };
  try {
    await connect();
    const initial = await readReport();
    if (initial.state.databaseEncrypted !== true || initial.state.databaseOpen !== true) throw new Error('NATIVE_ENCRYPTED_STORAGE_NOT_READY: complete normal system authentication and synthetic fixture setup first.');
    const rows = [];
    for (let sample = 0; sample < 3; sample++) {
      await evaluate(`localStorage.removeItem(${JSON.stringify(DIAGNOSTIC_STORAGE_KEY)})`);
      disconnect(); adb('shell', 'am', 'force-stop', 'com.spendwise.app');
      adb('shell', 'am', 'start', '-W', '-n', 'com.spendwise.app/.MainActivity');
      let report: ReturnType<DiagnosticStore['report']> | undefined;
      for (let attempt = 0; attempt < 30; attempt++) {
        try { if (!socket || socket.readyState !== WebSocket.OPEN) await connect(); report = await readReport(); if (report.state.databaseOpen === true) break; } catch { disconnect(); }
        await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
      }
      if (!report || report.state.databaseEncrypted !== true || report.state.databaseOpen !== true || !report.timings['storage.open'] || !report.timings['storage.read']) throw new Error('NATIVE_STARTUP_MEASUREMENT_UNAVAILABLE: normal system authentication or encrypted open/read did not complete. No bypass was attempted.');
      rows.push({ sample, state: report.state, timings: report.timings });
    }
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, JSON.stringify({ format: 'spendwise-native-benchmark-v1', generatedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), app: initial.app, fixture: { identity: 'wp32-v2-full', expenses: 1, attachments: 1, provenance: 'dedicated-runner-successful-isolated-restore' }, environment: { type: 'dedicated-synthetic-emulator', apiLevel, avd, nodeVersion: process.versions.node }, timingPolicy: 'warning-only; instrumentation includes plugin overhead, no physical-device claim', rows }, null, 2) + '\n');
    console.info('WP33 native encrypted open/read measurements saved.');
  } finally { disconnect(); try { adb('forward', '--remove', `tcp:${port}`); } catch {} }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await collectNativeBenchmark(process.argv[2] ?? 'artifacts/wp33/native-benchmark.json'); }
  catch (error) { console.error(error instanceof Error && /^[A-Z_]+(?:: [A-Za-z0-9 ._-]+)?$/.test(error.message) ? error.message : 'NATIVE_BENCHMARK_INFRASTRUCTURE_UNAVAILABLE'); process.exitCode = 1; }
}
