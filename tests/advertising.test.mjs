import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
function load(path, modules, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const context = { exports: {}, Date, URL, DOMException, performance, AbortController, crypto: globalThis.crypto, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'fragment' };
    if (name in modules) return modules[name]; throw new Error(`Unexpected dependency ${name}`);
  } };
  vm.runInNewContext(code, context); return context.exports;
}
const turn = () => new Promise(resolve => setImmediate(resolve));
function hooks() {
  const slots = [], effects = []; let cursor = 0;
  return {
    react: {
      useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useEffect(fn, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((d, i) => d !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
    },
    render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(run => run()); return result; },
    cleanup() { slots.forEach(s => s.cleanup?.()); },
  };
}
function find(node, type) { if (node == null) return null; if (Array.isArray(node)) return node.map(n => find(n, type)).find(Boolean); return node.type === type ? node : find(node.props?.children, type); }
const ad = { decision_id: 'server-decision', kind: 'video', url: 'https://media.example/ad.m3u8', duration_seconds: 20, skippable_after: 5, destination_url: 'https://brand.example/offer', advertiser: 'Sponsor' };

function playbackFixture({ enabled = true, start = 0, noAd = false, failing = false } = {}) {
  const engine = hooks(), requests = [], events = [], progress = []; let ended = 0;
  let now = 0;
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' }), observers = [];
  const session = { enabled: true, session: 'signed', placements: [{ code: 'preroll', breakpoints: [] }, { code: 'midroll', breakpoints: [60, 120] }, { code: 'postroll', breakpoints: [] }] };
  const services = {
    openAdSession: async () => session,
    decideAd: async (_session, placement, key) => { requests.push(`${placement}:${key}`); if (failing) throw new Error('Network unavailable'); return noAd ? null : { ...ad, decision_id: placement }; },
    recordAdEvent: async (_session, selected, kind) => events.push({ decision: selected.decision_id, kind }),
    approvedAdHref: selected => selected.destination_url,
  };
  const exports = load('components/AdvertisingVideo.tsx', { react: engine.react, './TrackedVideo': { TrackedVideo: 'TrackedVideo' }, '@/services/advertising': services }, { performance: { now: () => now }, window: new EventTarget(), CustomEvent, document, IntersectionObserver: class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} } });
  let props = { src: 'https://media.example/main.mp4?one', startSeconds: start, onPlay() {}, onProgress: (...values) => progress.push(values), onEnded: () => ended++, advertisingEnabled: enabled, viewerId: 1, playbackSessionId: 'server-session' };
  const render = (patch = {}) => {
    props = { ...props, ...patch }; const boundary = exports.AdvertisingVideo(props);
    return typeof boundary.type === 'function' ? engine.render(() => boundary.type(boundary.props)) : boundary;
  };
  const settle = async () => { await turn(); await turn(); return render(); };
  return { render, settle, cleanup: engine.cleanup, requests, events, progress, ended: () => ended, exports, engine, document, observers, services, time: value => { now = value; } };
}

test('disabled advertising renders the ordinary player without requests', async () => {
  const f = playbackFixture({ enabled: false });
  assert.equal(f.render().type, 'TrackedVideo'); await turn(); assert.equal(f.requests.length, 0); f.cleanup();
});

test('pre-roll, mid-roll and post-roll isolate organic progress and preserve main position', async () => {
  const f = playbackFixture();
  try {
    f.render(); let tree = await f.settle(); assert.equal(tree.props.ad.decision_id, 'preroll');
    assert.equal(f.progress.length, 0); tree.props.done(); tree = f.render(); assert.equal(tree.type, 'TrackedVideo');
    tree.props.onProgress(61, 180); tree = await f.settle(); assert.equal(tree.props.ad.decision_id, 'midroll');
    tree.props.done(); tree = f.render(); assert.equal(tree.props.startSeconds, 61);
    tree.props.onProgress(62, 180); await f.settle(); assert.equal(f.requests.filter(r => r === 'midroll:60').length, 1);
    tree = f.render({ src: 'https://media.example/main.mp4?renewed' }); assert.equal(tree.props.startSeconds, 62);
    assert.equal(f.requests.filter(r => r === 'preroll:once').length, 1);
    tree.props.onEnded(); tree = await f.settle(); assert.equal(tree.props.ad.decision_id, 'postroll'); assert.equal(f.ended(), 0);
    tree.props.done(); assert.equal(f.ended(), 1);
  } finally { f.cleanup(); }
});

test('resuming consumes earlier breakpoints and ad network failures continue content', async () => {
  const f = playbackFixture({ start: 90, failing: true });
  try {
    f.render(); let tree = await f.settle(); assert.equal(tree.type, 'TrackedVideo'); assert.equal(tree.props.startSeconds, 90);
    tree.props.onProgress(91, 180); await f.settle(); assert.equal(f.requests.includes('midroll:60'), false);
    tree = f.render(); tree.props.onEnded(); await f.settle(); assert.equal(f.ended(), 1);
  } finally { f.cleanup(); }
});

test('account or server-session changes create a separate ad boundary', () => {
  const f = playbackFixture();
  const first = f.exports.AdvertisingVideo({ advertisingEnabled: true, viewerId: 1, playbackSessionId: 'a' });
  const second = f.exports.AdvertisingVideo({ advertisingEnabled: true, viewerId: 2, playbackSessionId: 'a' });
  const third = f.exports.AdvertisingVideo({ advertisingEnabled: true, viewerId: 1, playbackSessionId: 'b' });
  assert.notEqual(first.key, second.key); assert.notEqual(first.key, third.key);
});

test('ad player failure emits an advertising failure and releases main content', async () => {
  const f = playbackFixture(); f.render(); const boundary = await f.settle();
  const mediaHooks = hooks();
  // Each rendered component needs its own hook slots, as in React.
  f.cleanup();
  Object.assign(f.engine.react, mediaHooks.react);
  const tree = mediaHooks.render(() => boundary.type(boundary.props));
  const player = find(tree, 'TrackedVideo');
  assert.equal(player.props.advertisement, true); player.props.onError();
  assert.equal(f.events.at(-1).kind, 'failure');
  assert.equal(f.progress.length, 0);
  mediaHooks.cleanup();
});

test('video impressions require continuous visible playing time and retry rejected events', async () => {
  const f = playbackFixture(); f.render(); const boundary = await f.settle(); f.cleanup();
  const mediaHooks = hooks(); Object.assign(f.engine.react, mediaHooks.react);
  const tree = mediaHooks.render(() => boundary.type(boundary.props));
  const player = find(tree, 'TrackedVideo');
  let impressions = 0;
  f.services.recordAdEvent = async (_session, _ad, kind) => { f.events.push({ kind }); if (kind === 'impression') return ++impressions > 1; return true; };
  try {
    find(tree, 'a').props.onClick(); await turn();
    assert.ok(f.events.some(event => event.kind === 'click'));
    assert.equal(impressions, 0, 'an early explicit click does not fabricate an impression');
    f.observers[0]([{ intersectionRatio: 1 }]);
    player.props.onPlaybackState(true); await turn();
    player.props.onProgress(0, 20);
    f.time(1900); player.props.onProgress(2, 20);
    assert.equal(impressions, 0);
    f.document.visibilityState = 'hidden'; f.document.dispatchEvent(new Event('visibilitychange'));
    f.time(2500); f.document.visibilityState = 'visible'; player.props.onProgress(3, 20);
    f.time(2600); player.props.onProgress(4, 20); assert.equal(impressions, 0, 'hidden time does not qualify');
    player.props.onPlaybackState(false);
    f.time(4000); player.props.onPlaybackState(true); player.props.onProgress(4, 20);
    f.time(5900); player.props.onProgress(5, 20); assert.equal(impressions, 0, 'buffering resets qualification');
    f.time(6100); player.props.onProgress(6, 20); await turn(); assert.equal(impressions, 1);
    f.time(6400); player.props.onProgress(7, 20); await turn(); assert.equal(impressions, 2, 'a rejected event remains retryable');
    f.time(6700); player.props.onProgress(8, 20); await turn(); assert.equal(impressions, 2, 'acknowledged impression is not repeated');
  } finally { mediaHooks.cleanup(); }
});

test('ad service binds events to the issued decision, orders ingestion and validates click targets', async () => {
  const calls = [], owners = [];
  const client = { request: async config => { calls.push(config); return { data: config.url.includes('decision') ? { ad } : { accepted: true } }; } };
  const service = load('services/advertising.ts', { './api': { publicApiClient: client }, './viewer-api': { viewerRequest: async (owner, config) => { owners.push(owner); return client.request(config); } } }, { window: new EventTarget(), CustomEvent });
  const session = { enabled: true, session: 'signed', placements: [{ code: 'preroll' }] };
  await service.decideAd(session, 'preroll', 'once', 42);
  assert.equal(calls[0].data.session, 'signed'); assert.ok(calls[0].data.request_id);
  await Promise.all([service.recordAdEvent(session, ad, 'video_start', 0, 42), service.recordAdEvent(session, ad, 'impression', 3, 42)]);
  assert.deepEqual(calls.slice(1).map(c => c.data.kind), ['video_start', 'impression']);
  assert.ok(calls.every(c => c.data.decision_id === 'server-decision' || c.url.includes('decision')));
  assert.ok(owners.every(owner => owner === 42));
  assert.equal(service.approvedAdHref({ destination_url: 'javascript:alert(1)' }), undefined);
  assert.equal(service.approvedAdHref({ destination_url: 'https://brand.example/offer' }), 'https://brand.example/offer');
});

test('page placements share one viewer context and refresh it before decisions expire', async () => {
  let now = 0, count = 0;
  class Clock extends Date { static now() { return now; } }
  const client = { request: async () => ({ data: { enabled: true, session: `issued-${++count}`, placements: [] } }) };
  const service = load('services/advertising.ts', { './api': { publicApiClient: client }, './viewer-api': { viewerRequest: async (_owner, config) => client.request(config) } }, { Date: Clock });
  const [first, sibling] = await Promise.all([service.openAdSession({ context: 'homepage' }, 1), service.openAdSession({ context: 'homepage' }, 1)]);
  assert.equal(first.session, sibling.session); assert.equal(count, 1);
  now = 11 * 60 * 1000;
  assert.notEqual((await service.openAdSession({ context: 'homepage' }, 1)).session, first.session);
  assert.notEqual((await service.openAdSession({ context: 'homepage' }, 2)).session, first.session);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.openAdSession({ context: 'homepage' }, 2, controller.signal), e => e.name === 'AbortError');
});
