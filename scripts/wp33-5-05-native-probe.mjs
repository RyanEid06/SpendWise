// Read-only CDP observations of the synthetic disposable Android test installation.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import assert from 'node:assert/strict';

const [phase, output] = process.argv.slice(2);
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 15000 });
let target;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const pid = adb('shell', 'pidof', 'com.spendwise.app').trim();
    assert.match(pid, /^\d+$/);
    adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
    target = (await (await fetch('http://127.0.0.1:9222/json')).json()).find(t => t.type === 'page');
    if (target) break;
  } catch { /* Wait for the newly created WebView, never unlock it here. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(target, 'No native WebView for observation');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  clearTimeout(waiter.timer);
  message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
});
const evaluate = expression => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => reject(new Error('Native observation timed out')), 15000);
  pending.set(id, { resolve, reject, timer });
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
});
const expression = `(() => ({
  text: document.body.innerText,
  inputs: [...document.querySelectorAll('input,textarea')].map(e => ({label:e.getAttribute('aria-label'),value:e.value})),
  dialogs: [...document.querySelectorAll('[role=dialog]')].map(e=>e.getAttribute('aria-labelledby')),
  category: document.querySelector('[data-expense-categories] [aria-pressed=true]')?.innerText,
  photos: [...document.querySelectorAll('[role=dialog] img')].map(e=>({width:e.naturalWidth,height:e.naturalHeight,src:e.src.slice(0,5)})),
  localValues: Object.values(localStorage),
  status: document.querySelector('[data-testid=draft-status]')?.innerText
}))()`;
try {
  let state;
  for (let attempt = 0; attempt < 30; attempt++) {
    const observed = await evaluate(expression);
    if (observed.exceptionDetails) throw new Error('DOM observation failed');
    state = observed.result.value;
    if (phase === 'locked' ? /SpendWise is Locked|Unlocking/.test(state.text)
        : ['add', 'photo'].includes(phase) ? state.status === 'Unfinished expense protected'
        : state.text.includes('Money Remaining')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  mkdirSync(dirname(output), { recursive: true });
  const { localValues, ...receipt } = state;
  receipt.plaintextDraftInLocalStorage = localValues.some(value => /WP05 Native Recovery|WP05 Native Edited/.test(value));
  writeFileSync(output, JSON.stringify(receipt, null, 2));
  assert.equal(receipt.plaintextDraftInLocalStorage, false);
  const field = label => state.inputs.find(i => i.label?.startsWith(label))?.value;
  if (phase === 'locked') {
    assert.match(state.text, /SpendWise is Locked|Unlocking/);
    assert.equal(state.dialogs.length, 0);
    assert.equal(state.inputs.some(i => /WP05 Native/.test(i.value)), false);
    assert.equal(/WP05 Native/.test(state.text), false);
  } else if (phase === 'add' || phase === 'photo') {
    assert.equal(field('Amount'), '37.25');
    assert.equal(field('Description'), 'WP05 Native Recovery');
    assert.match(state.category, /Food & Beverage/);
    assert.equal(state.status, 'Unfinished expense protected');
    if (phase === 'photo') {
      assert.equal(state.photos.length, 1);
      assert.equal(state.photos[0].width, 1024);
      assert.equal(state.photos[0].src, 'blob:');
    }
  } else if (phase === 'saved' || phase === 'edited') {
    assert.equal(state.dialogs.length, 0);
    const expected = phase === 'saved' ? 'WP05 Native Recovery' : 'WP05 Native Edited';
    // Home presents the one saved expense once. No second Save or recreated Add.
    assert.equal(state.text.split(expected).length - 1, 1);
    const files = adb('shell','run-as','com.spendwise.app','find','files/expense-attachments/secure','-type','f').trim().split(/\r?\n/).filter(Boolean);
    assert.equal(files.length, 1, 'One permanent encrypted photo, without discarded copies/orphans');
  } else throw new Error('Unknown probe phase');
  console.log(`WP05_NATIVE_PROBE_PASSED:${phase}`);
} finally { socket.close(); }
