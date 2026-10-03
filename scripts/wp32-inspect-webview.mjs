// Debug-only CI evidence from the synthetic WP32 ledger. Never run on user data.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = process.argv[2];
const appId = 'com.spendwise.app';
mkdirSync(output, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 15000 });
const pid = adb('shell', 'pidof', appId).trim().split(' ')[0];
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
        classes: element.className, rect: element.getBoundingClientRect().toJSON(),
        position: style.position, transform: style.transform, overflow: style.overflow,
        filter: style.filter, backdropFilter: style.backdropFilter, visibility: style.visibility };
    };
    return { scrollY, innerHeight, viewport: { height: visualViewport.height, offsetTop: visualViewport.offsetTop },
      shell: [...document.querySelector('#root').children].map(inspect),
      controls: [...document.querySelectorAll('nav, nav button, [aria-label="Add Expense"], #main-content')].map(inspect) };
  })()`);
  writeFileSync(`${output}/${name}-layout.json`, JSON.stringify(layout, null, 2));
  writeFileSync(`${output}/${name}-ax.json`, JSON.stringify(await cdp('Accessibility.getFullAXTree'), null, 2));
  adb('shell', 'uiautomator', 'dump', '/sdcard/wp32-probe.xml');
  const hierarchy = adb('shell', 'cat', '/sdcard/wp32-probe.xml');
  writeFileSync(`${output}/${name}-native.xml`, hierarchy);
  console.log(`${name}: native History=${hierarchy.includes('text="History"')}, Add Expense=${hierarchy.includes('text="Add Expense"')}`);
}
try {
  const originalScrollY = await evaluate('scrollY');
  await capture('original');
  await evaluate('window.scrollTo(0, 0)');
  await capture('scroll-top');
  // Restore scroll before independently probing the fixed controls' DOM order.
  await evaluate(`window.scrollTo(0, ${JSON.stringify(originalScrollY)})`);
  await evaluate(`(() => {
    const main = document.querySelector('#main-content');
    const nav = document.querySelector('nav');
    const add = document.querySelector('[aria-label="Add Expense"]');
    if (nav) main.before(nav);
    if (add) main.before(add);
  })()`);
  await capture('controls-before-main');
  await evaluate(`(() => {
    const nav = document.querySelector('nav');
    const add = document.querySelector('[aria-label="Add Expense"]');
    if (nav) document.body.append(nav);
    if (add) document.body.append(add);
  })()`);
  await capture('controls-in-body');
} finally {
  socket.close();
  adb('forward', '--remove', 'tcp:9222');
}
