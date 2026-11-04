import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { publicApiClient, unauthorizedEvent } = require('../src/services/api.ts');
const { viewerRequest, ViewerSessionChangedError } = require('../src/services/viewer-api.ts');
const token = (userId, label = '') => `header.${Buffer.from(JSON.stringify({ user_id: userId, label })).toString('base64url')}.signature`;
const unauthorized = () => Object.assign(new Error('expired'), { isAxiosError: true, response: { status: 401 } });
function storage(userId) {
  const values = new Map([['access_token', token(userId, 'old')], ['refresh_token', token(userId, 'refresh')]]);
  const state = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: state });
  return state;
}

function documentEvents() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const events = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { dispatchEvent: event => { events.push(event); return true; } } });
  return { events, restore: () => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; } };
}

test('expired owner access refreshes and retries progress with explicit matching bearer', async () => {
  const state = storage(12), requests = [];
  const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
  try {
    publicApiClient.request = async config => { requests.push(config); if (requests.length === 1) throw unauthorized(); return { data: { position_seconds: 42 } }; };
    publicApiClient.post = async (url, body) => { assert.equal(url, '/api/accounts/token/refresh/'); assert.equal(body.refresh, token(12, 'refresh')); return { data: { access: token(12, 'new') } }; };
    const result = await viewerRequest(12, { method: 'POST', url: '/api/library/progress/', data: { content: 1, position_seconds: 42 } });
    assert.equal(result.data.position_seconds, 42);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].headers.Authorization, `Bearer ${token(12, 'new')}`);
    assert.equal(state.getItem('access_token'), token(12, 'new'));
  } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; }
});

test('account switch during refresh cannot overwrite new credentials or retry old activity', async () => {
  const state = storage(12);
  const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
  let requests = 0;
  try {
    publicApiClient.request = async () => { requests++; throw unauthorized(); };
    publicApiClient.post = async () => { state.setItem('access_token', token(13)); state.setItem('refresh_token', token(13, 'refresh')); return { data: { access: token(12, 'new') } }; };
    await assert.rejects(viewerRequest(12, { method: 'POST', url: '/api/library/progress/' }), ViewerSessionChangedError);
    assert.equal(requests, 1);
    assert.equal(state.getItem('access_token'), token(13));
  } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; }
});

test('wrong-account tokens prevent both reads and writes before any request', async () => {
  storage(13);
  const originalRequest = publicApiClient.request;
  let requests = 0;
  try {
    publicApiClient.request = async () => { requests++; return { data: {} }; };
    await assert.rejects(viewerRequest(12, { url: '/api/library/progress/1/' }), ViewerSessionChangedError);
    await assert.rejects(viewerRequest(12, { method: 'POST', url: '/api/library/progress/' }), ViewerSessionChangedError);
    assert.equal(requests, 0);
  } finally { publicApiClient.request = originalRequest; }
});

for (const status of [400, 401]) {
  test(`terminal refresh ${status} clears only the owner session and signals authentication loss`, async () => {
    const state = storage(12), document = documentEvents();
    const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
    const rejected = Object.assign(new Error('Refresh rejected'), { isAxiosError: true, response: { status } });
    let requests = 0;
    try {
      publicApiClient.request = async () => { requests++; throw unauthorized(); };
      publicApiClient.post = async () => { throw rejected; };
      await assert.rejects(viewerRequest(12, { url: '/api/library/progress/1/' }), error => error === rejected);
      assert.equal(requests, 1);
      assert.equal(state.getItem('access_token'), null);
      assert.equal(state.getItem('refresh_token'), null);
      assert.deepEqual(document.events, [unauthorizedEvent]);
    } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; document.restore(); }
  });

  test(`refresh ${status} after an account switch preserves the new session without logging it out`, async () => {
    const state = storage(12), document = documentEvents();
    const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
    try {
      publicApiClient.request = async () => { throw unauthorized(); };
      publicApiClient.post = async () => {
        state.setItem('access_token', token(13, 'new'));
        state.setItem('refresh_token', token(13, 'refresh'));
        throw Object.assign(new Error('Refresh rejected'), { isAxiosError: true, response: { status } });
      };
      await assert.rejects(viewerRequest(12, { url: '/api/library/progress/1/' }), ViewerSessionChangedError);
      assert.equal(state.getItem('access_token'), token(13, 'new'));
      assert.equal(state.getItem('refresh_token'), token(13, 'refresh'));
      assert.deepEqual(document.events, []);
    } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; document.restore(); }
  });
}

for (const [label, failure] of [
  ['network failure', new Error('Connection unavailable')],
  ['server failure', Object.assign(new Error('Service unavailable'), { isAxiosError: true, response: { status: 503 } })],
]) {
  test(`transient refresh ${label} retains credentials for retry`, async () => {
    const state = storage(12), document = documentEvents();
    const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
    try {
      publicApiClient.request = async () => { throw unauthorized(); };
      publicApiClient.post = async () => { throw failure; };
      await assert.rejects(viewerRequest(12, { url: '/api/library/progress/1/' }), error => error === failure);
      assert.equal(state.getItem('access_token'), token(12, 'old'));
      assert.equal(state.getItem('refresh_token'), token(12, 'refresh'));
      assert.deepEqual(document.events, []);
    } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; document.restore(); }
  });
}

test('rejected refresh cannot clear a concurrently refreshed access token for the same account', async () => {
  const state = storage(12), document = documentEvents();
  const originalRequest = publicApiClient.request, originalPost = publicApiClient.post;
  try {
    publicApiClient.request = async () => { throw unauthorized(); };
    publicApiClient.post = async () => { state.setItem('access_token', token(12, 'new')); throw unauthorized(); };
    await assert.rejects(viewerRequest(12, { url: '/api/library/progress/1/' }), ViewerSessionChangedError);
    assert.equal(state.getItem('access_token'), token(12, 'new'));
    assert.equal(state.getItem('refresh_token'), token(12, 'refresh'));
    assert.deepEqual(document.events, []);
  } finally { publicApiClient.request = originalRequest; publicApiClient.post = originalPost; document.restore(); }
});
