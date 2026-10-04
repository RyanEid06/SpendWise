// Debug-only probes on the disposable WP32 emulator and synthetic ledger.
// Capture the unmodified failure before testing accessibility invalidation.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = process.argv[2];
mkdirSync(output, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 15000 });
const pid = adb('shell', 'pidof', 'com.spendwise.app').trim().split(' ')[0];
if (!pid) throw new Error('SpendWise is not running');
adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find(item => item.type === 'page');
if (!target) throw new Error('No debuggable SpendWise WebView');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const response = JSON.parse(event.data);
  const waiter = pending.get(response.id);
  if (!waiter) return;
  pending.delete(response.id);
  clearTimeout(waiter.timer);
  response.error ? waiter.reject(new Error(JSON.stringify(response.error))) : waiter.resolve(response.result);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function capture(name) {
  const layout = await evaluate(`(() => {
    const inspect = element => {
      const style = getComputedStyle(element);
      return { tag: element.tagName, id: element.id, label: element.getAttribute('aria-label'),
        ariaHidden: element.getAttribute('aria-hidden'), inert: element.inert,
        classes: element.className, rect: element.getBoundingClientRect().toJSON(),
        position: style.position, transform: style.transform, overflow: style.overflow,
        opacity: style.opacity, animation: style.animation, display: style.display,
        filter: style.filter, backdropFilter: style.backdropFilter, visibility: style.visibility };
    };
    return { scrollY, innerHeight, viewport: { height: visualViewport.height, offsetTop: visualViewport.offsetTop },
      active: inspect(document.activeElement),
      controls: [...document.querySelectorAll('#root, #root > div, main, main > div, [role="dialog"], main button, main span')].map(inspect),
      dialogs: document.querySelectorAll('[role="dialog"]').length };
  })()`);
  writeFileSync(`${output}/${name}-layout.json`, JSON.stringify(layout, null, 2));
  writeFileSync(`${output}/${name}-ax.json`, JSON.stringify(await cdp('Accessibility.getFullAXTree'), null, 2));
  adb('shell', 'uiautomator', 'dump', '/sdcard/wp32-probe.xml');
  const hierarchy = adb('shell', 'cat', '/sdcard/wp32-probe.xml');
  writeFileSync(`${output}/${name}-native.xml`, hierarchy);
  console.log(`${name}: native Backup restored=${hierarchy.includes('Backup restored')}, Back=${hierarchy.includes('text="Back"')}`);
}
try {
  writeFileSync(`${output}/version.json`, JSON.stringify(await cdp('Browser.getVersion'), null, 2));
  await capture('original');
  const originalFocus = await evaluate('document.activeElement.id');
  await evaluate("document.querySelector('#main-content')?.focus({preventScroll:true})");
  await capture('focus-main');
  await evaluate(`(() => {
    document.activeElement.blur();
    if (${JSON.stringify(originalFocus)}) document.getElementById(${JSON.stringify(originalFocus)})?.focus({preventScroll:true});
    document.querySelectorAll('.animate-screen-enter').forEach(element => element.style.animation = 'none');
  })()`);
  await capture('no-animation');
} finally {
  socket.close();
  adb('forward', '--remove', 'tcp:9222');
}
