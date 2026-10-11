import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Rect { top: number; bottom: number; left: number; right: number }
interface Layout {
  viewport: { top: number; height: number; width: number };
  padding: Rect;
  nativeInsets: Rect;
  card: Rect; header: Rect; footer: Rect; scroll: Rect; field: Rect;
}
export function assertEditorLayout(layout: Layout) {
  const { viewport, padding, nativeInsets, card } = layout;
  const contains = (outer: Rect, inner: Rect) => {
    for (const n of Object.values(inner)) assert.ok(Number.isFinite(n), 'Invalid geometry');
    assert.ok(inner.bottom > inner.top && inner.right > inner.left, 'Empty control');
    assert.ok(inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1 &&
      inner.left >= outer.left - 1 && inner.right <= outer.right + 1, 'Control covered or outside safe bounds');
  };
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const inset = nativeInsets?.[side];
    assert.ok(Number.isFinite(inset) && inset >= 0, 'Missing native inset propagation');
    assert.ok(Number.isFinite(padding[side]) && Math.abs(padding[side] - inset - 14) <= 1,
      'Native inset must be applied exactly once plus 14px breathing room');
  }
  contains({ top: viewport.top + padding.top, bottom: viewport.top + viewport.height - padding.bottom,
    left: padding.left, right: viewport.width - padding.right }, card);
  contains(card, layout.header); contains(card, layout.footer); contains(layout.scroll, layout.field);
}

async function capture(output: string) {
  const serial = process.env.ANDROID_SERIAL ?? '';
  if (!/^emulator-\d+$/.test(serial)) throw new Error('SYNTHETIC_EMULATOR_REQUIRED');
  const adb = (...args: string[]) => execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000 });
  if (adb('shell', 'getprop', 'ro.kernel.qemu').trim() !== '1' ||
    !/^wp33-synthetic(?:-[A-Za-z0-9_-]+)?$/.test(adb('emu', 'avd', 'name').split(/\r?\n/)[0])) throw new Error('SYNTHETIC_EMULATOR_REQUIRED');
  const pid = adb('shell', 'pidof', 'com.spendwise.app').trim().split(' ')[0];
  if (!/^\d+$/.test(pid)) throw new Error('APP_NOT_RUNNING');
  const port = 9235;
  adb('forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`);
  let socket: WebSocket | undefined;
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(15000) })).json() as Array<{ type: string; webSocketDebuggerUrl: string }>;
    const target = targets.find(item => item.type === 'page');
    if (!target) throw new Error('WEBVIEW_NOT_DEBUGGABLE');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP_CONNECT_TIMEOUT')), 15000);
      socket!.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket!.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP_CONNECT_FAILED')); }, { once: true });
    });
    const expression = `(() => {
      const dialog = document.querySelector('.expense-editor-viewport');
      if (!dialog) throw new Error('EDITOR_NOT_VISIBLE');
      const card = dialog.firstElementChild;
      const rect = node => node.getBoundingClientRect().toJSON();
      const style = getComputedStyle(dialog);
      const focused = document.activeElement;
      if (!focused.matches('input, textarea')) throw new Error('INPUT_NOT_FOCUSED');
      return { viewport: { top: visualViewport.offsetTop, height: visualViewport.height, width: innerWidth },
        padding: { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) },
        card: rect(card), header: rect(card.firstElementChild), footer: rect(card.lastElementChild),
        field: rect(focused), scroll: rect(card.querySelector('[data-expense-scroll-body]')),
        nativeInsets: Object.fromEntries(['top','bottom','left','right'].map(side =>
          [side, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-' + side))])) };
    })()`;
    const result = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP_LAYOUT_TIMEOUT')), 15000);
      socket!.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error || message.result.exceptionDetails) reject(new Error('CDP_LAYOUT_FAILED'));
        else resolve(message.result.result.value);
      });
      socket!.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
    writeFileSync(output + '-geometry.json', JSON.stringify(result, null, 2) + '\n');
    assertEditorLayout(result);
    console.info('WP35_EDITOR_GEOMETRY_PASSED');
  } finally { socket?.close(); adb('forward', '--remove', `tcp:${port}`); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await capture(process.argv[2]);
}
