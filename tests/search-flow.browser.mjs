// Run after a production build and `next start -p 3010`.
// Uses Chrome DevTools to exercise the real navigation and search controls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9338', '--user-data-dir=' + process.cwd() + '/.next/search-flow-chrome',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${expression}`);
}

try {
  let endpoint;
  for (let i = 0; i < 50; i++) {
    try {
      endpoint = (await fetch('http://127.0.0.1:9338/json/list').then((response) => response.json()))
        .find((tab) => tab.type === 'page')?.webSocketDebuggerUrl;
      if (endpoint) break;
    } catch { /* Chrome is starting. */ }
    await delay(200);
  }
  assert.ok(endpoint, 'Chrome DevTools did not start');
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onclose = () => {
    for (const request of pending.values()) request.reject(new Error('Chrome DevTools connection closed'));
    pending.clear();
  };
  socket.onmessage = async ({ data }) => {
    const packet = JSON.parse(data);
    if (packet.method === 'Fetch.requestPaused') {
      const url = new URL(packet.params.request.url);
      const mode = url.searchParams.get('search_by') || 'title';
      const title = mode === 'director' ? 'Amina Director' : 'African Wildlife';
      const body = JSON.stringify({
        query: url.searchParams.get('q'), search_by: mode, count: 1, total: 1,
        offset: 0, next_offset: null, source: 'database',
        hits: [{ id: mode === 'director' ? 2 : 1, title, thumbnail: null,
          director: mode === 'director' ? 'Amina' : 'Nuru', genre: 'Wildlife', content_type: 'documentary' }],
      });
      send('Fetch.fulfillRequest', { requestId: packet.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(body).toString('base64') }).catch(() => {});
      return;
    }
    const request = pending.get(packet.id);
    if (!request) return;
    pending.delete(packet.id);
    if (packet.error) request.reject(new Error(packet.error.message));
    else request.resolve(packet);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*api/content/search/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:3010/' });
  await waitFor("document.querySelector('[aria-label=\"Search catalogue\"]')");
  await delay(1500);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[aria-label=\"Search catalogue\"]')).display !== 'none'"), true);
  await evaluate("document.querySelector('[aria-label=\"Search catalogue\"]').click()");
  await waitFor("document.querySelector('input[aria-label=\"Search titles\"]')");
  await evaluate("document.querySelector('input[aria-label=\"Search titles\"]').focus()");
  await send('Input.insertText', { text: 'African Wildlife' });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor("location.pathname === '/search' && new URLSearchParams(location.search).get('search_by') === 'title'");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), 'African Wildlife');
  await waitFor("document.body.textContent.includes('African Wildlife') && document.querySelector('#search-mode')");
  assert.equal(await evaluate("document.querySelector('#search-mode').value"), 'title');
  assert.equal(await evaluate("document.querySelector('[role=\"dialog\"]') === null"), true);
  await evaluate(`(() => { const select = document.querySelector('#search-mode');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'director');
    select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor("new URLSearchParams(location.search).get('search_by') === 'director'");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), 'African Wildlife');
  assert.equal(await evaluate("new URLSearchParams(location.search).get('page')"), null);
  await waitFor("document.body.textContent.includes('Amina Director')");
  assert.equal(await evaluate("document.querySelector('#search-mode').value"), 'director');
  await evaluate('history.back()');
  await waitFor("new URLSearchParams(location.search).get('search_by') === 'title'");
  assert.equal(await evaluate("document.querySelector('#search-mode').value"), 'title');
  console.log('Search flow: mobile icon, Enter, default title, mode refresh, URL and browser back passed');
} finally {
  socket?.close();
  browser.kill();
}
