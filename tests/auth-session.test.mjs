import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const axios = require('axios');
const { jwtDecode } = require('jwt-decode');
const source = path => ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const apiSource = source('services/api.ts'), authSource = source('context/AuthContext.tsx');
const token = (id, label) => `header.${Buffer.from(JSON.stringify({ user_id: id, label })).toString('base64url')}.signature`;
const viewer = id => ({ id, name: `Viewer ${id}`, email: `viewer${id}@example.test` });
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}
function browser() {
  const values = new Map(), events = [], window = new EventTarget(), document = new EventTarget();
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  document.addEventListener('unauthorized', event => events.push(event.type));
  const install = (id, label = 'old') => {
    localStorage.setItem('access_token', token(id, label));
    localStorage.setItem('refresh_token', token(id, `refresh-${label}`));
  };
  install(1);
  return { window, document, localStorage, install, events };
}
function apiFixture() {
  const env = browser();
  const context = {
    ...env, exports: {}, Event, process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://api.example' } },
    console: { error() { throw new Error('Authentication failures must not log response bodies or headers'); } },
    require(name) {
      if (name === 'axios') return axios;
      if (name === 'jwt-decode') return { jwtDecode };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(apiSource, context, { filename: 'services/api.ts' });
  return { ...env, ...context.exports, api: context.exports.default };
}
const success = (config, data = { ok: true }) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const failure = (config, status = 401) => new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { config, status, data: {}, headers: {}, statusText: 'Failed' });

test('simultaneous expired requests share one refresh and retry with the new bearer', async () => {
  const fixture = apiFixture(), gate = deferred();
  let refreshes = 0;
  fixture.publicApiClient.post = async () => { refreshes++; return gate.promise; };
  fixture.api.defaults.adapter = async config => {
    if (config.headers.Authorization === `Bearer ${token(1, 'old')}`) throw failure(config);
    assert.equal(config.headers.Authorization, `Bearer ${token(1, 'renewed')}`);
    return success(config);
  };
  const first = fixture.api.get('/first'), second = fixture.api.get('/second');
  await turn();
  assert.equal(refreshes, 1);
  gate.resolve({ data: { access: token(1, 'renewed') } });
  await Promise.all([first, second]);
  assert.equal(fixture.localStorage.getItem('access_token'), token(1, 'renewed'));
});

test('a successful old-account response is rejected after account switching', async () => {
  const fixture = apiFixture(), gate = deferred();
  fixture.api.defaults.adapter = async config => { await gate.promise; return success(config, { id: 1 }); };
  const pending = fixture.api.get('/profile'); pending.catch(() => {});
  await turn(); fixture.install(2); gate.resolve();
  await assert.rejects(pending, fixture.SessionChangedError);
});

test('switching accounts during refresh cannot replace new credentials or retry the old activity', async () => {
  const fixture = apiFixture(), gate = deferred();
  let sends = 0;
  fixture.publicApiClient.post = () => gate.promise;
  fixture.api.defaults.adapter = async config => { sends++; throw failure(config); };
  const pending = fixture.api.post('/private-action', { value: 1 }); pending.catch(() => {});
  await turn(); fixture.install(2); gate.resolve({ data: { access: token(1, 'renewed') } });
  await assert.rejects(pending, fixture.SessionChangedError);
  assert.equal(fixture.localStorage.getItem('access_token'), token(2, 'old'));
  assert.equal(sends, 1);
  assert.equal(fixture.events.length, 0);
});

test('transient refresh errors preserve the session; invalid refresh expires only its own session', async () => {
  const fixture = apiFixture();
  fixture.api.defaults.adapter = async config => { throw failure(config); };
  fixture.publicApiClient.post = async () => { throw failure({}, 503); };
  await assert.rejects(fixture.api.get('/outage'));
  assert.equal(fixture.localStorage.getItem('refresh_token'), token(1, 'refresh-old'));
  assert.equal(fixture.events.length, 0);
  fixture.publicApiClient.post = async () => { throw failure({}, 401); };
  await assert.rejects(fixture.api.get('/expired'));
  assert.equal(fixture.localStorage.getItem('access_token'), null);
  assert.equal(fixture.localStorage.getItem('refresh_token'), null);
  assert.deepEqual(fixture.events, ['unauthorized']);
});

test('another request can renew the same session without causing a second refresh', async () => {
  const fixture = apiFixture(), gate = deferred();
  let refreshes = 0;
  fixture.publicApiClient.post = async () => { refreshes++; return { data: { access: token(1, 'unexpected') } }; };
  fixture.api.defaults.adapter = async config => {
    if (config.headers.Authorization === `Bearer ${token(1, 'old')}`) { await gate.promise; throw failure(config); }
    assert.equal(config.headers.Authorization, `Bearer ${token(1, 'renewed')}`);
    return success(config);
  };
  const pending = fixture.api.get('/private');
  await turn(); fixture.localStorage.setItem('access_token', token(1, 'renewed')); gate.resolve();
  await pending;
  assert.equal(refreshes, 0);
});

test('anonymous requests remove stale default authorization headers', async () => {
  const fixture = apiFixture();
  fixture.localStorage.removeItem('access_token'); fixture.localStorage.removeItem('refresh_token');
  fixture.api.defaults.headers.common.Authorization = 'Bearer stale';
  fixture.api.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, undefined);
    return success(config);
  };
  await fixture.api.get('/anonymous');
  assert.equal(fixture.api.defaults.headers.common.Authorization, undefined);
});

function authFixture() {
  const env = browser(), slots = [], effects = [], profiles = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useContext() {},
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, offset) => !Object.is(value, old.deps[offset]))) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    },
  };
  const api = { defaults: { headers: { common: {} } } };
  const context = { ...env, exports: {}, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (name === '@/services/api') return { __esModule: true, default: api, unauthorizedEvent: new Event('unauthorized') };
    if (name === '@/services/accounts') return { getUserProfile: () => { const result = deferred(); profiles.push(result); return result.promise; } };
    if (name === '@/lib/homepage-progress') return { progressTokenBelongsToUser(value, id) { try { return String(jwtDecode(value).user_id) === String(id); } catch { return false; } } };
    throw new Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(authSource, context, { filename: 'context/AuthContext.tsx' });
  const render = () => {
    cursor = 0;
    const tree = context.exports.AuthProvider({ children: null });
    effects.splice(0).forEach(run => run());
    return tree.props.value;
  };
  const storageEvent = () => {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: 'access_token' }, storageArea: { value: env.localStorage } });
    env.window.dispatchEvent(event);
  };
  const actions = render();
  return { ...env, actions, render, profiles, storageEvent, cleanup: () => slots.forEach(slot => slot.cleanup?.()) };
}

test('profile restoration cannot overwrite a newer login or logout', async () => {
  const login = authFixture();
  try {
    login.actions.login(viewer(2), token(2, 'new'), token(2, 'refresh-new'));
    login.profiles[0].resolve({ data: viewer(1) }); await turn();
    assert.equal(login.render().user.id, 2);
    assert.equal(login.render().loading, false);
  } finally { login.cleanup(); }
  const logout = authFixture();
  try {
    logout.actions.logout(); logout.profiles[0].resolve({ data: viewer(1) }); await turn();
    assert.equal(logout.render().user, null);
    assert.equal(logout.render().loading, false);
  } finally { logout.cleanup(); }
});

test('cross-tab account switching restores the new viewer while renewal preserves the active viewer', async () => {
  const fixture = authFixture();
  try {
    fixture.profiles[0].resolve({ data: viewer(1) }); await turn();
    assert.equal(fixture.render().user.id, 1);
    fixture.localStorage.setItem('access_token', token(1, 'renewed')); fixture.storageEvent();
    assert.equal(fixture.profiles.length, 1);
    assert.equal(fixture.render().user.id, 1);
    fixture.install(2); fixture.storageEvent();
    assert.equal(fixture.render().user, null);
    assert.equal(fixture.render().loading, true);
    fixture.profiles[1].resolve({ data: viewer(2) }); await turn();
    assert.equal(fixture.render().user.id, 2);
    assert.equal(fixture.render().loading, false);
    assert.throws(() => fixture.actions.login(viewer(3), token(2, 'wrong-owner'), token(3, 'refresh')));
    assert.equal(fixture.localStorage.getItem('access_token'), token(2, 'old'));
  } finally { fixture.cleanup(); }
});
