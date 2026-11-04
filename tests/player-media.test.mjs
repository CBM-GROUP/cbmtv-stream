import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { jwtDecode } = require('jwt-decode');
const compiled = new Map();
function source(path) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText);
  return compiled.get(path);
}
const turn = () => new Promise(resolve => setImmediate(resolve));
const token = (id, label = '') => `header.${Buffer.from(JSON.stringify({ user_id: id, label })).toString('base64url')}.signature`;

// Hooks and SDK/media objects are simulated. These tests do not decode real media.
function hooks(firstRef) {
  const slots = [], pending = [];
  let cursor = 0;
  const changed = (old, deps) => !old || deps.some((value, index) => !Object.is(value, old.deps[index]));
  const memo = (fn, deps) => {
    const index = cursor++, old = slots[index];
    if (changed(old, deps)) slots[index] = { value: fn(), deps };
    return slots[index].value;
  };
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: index === 0 && firstRef ? firstRef : initial }; },
      useMemo: memo,
      useCallback: (fn, deps) => memo(() => fn, deps),
      useEffect(fn, deps) {
        const index = cursor++, old = slots[index];
        if (changed(old, deps)) pending.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      },
    },
    render(fn, beforeEffects = () => {}) {
      cursor = 0;
      const result = fn();
      beforeEffects(result);
      pending.splice(0).forEach(run => run());
      return result;
    },
    cleanup: () => slots.forEach(slot => slot.cleanup?.()),
  };
}
function find(node, type) {
  if (!node) return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, type)).find(Boolean);
  return node.type === type ? node : find(node.props?.children, type);
}
function environment() {
  const window = new EventTarget(), document = new EventTarget(), timers = new Map(), scripts = [], metrics = [];
  window.location = { origin: 'https://viewer.example' };
  window.addEventListener('cbmtv:playback-metric', event => metrics.push(event.detail));
  document.visibilityState = 'visible';
  document.createElement = () => Object.assign(new EventTarget(), { remove() { this.removed = true; } });
  document.head = { appendChild: script => scripts.push(script) };
  const schedule = (fn, ms, interval = false) => { const timer = { fn, ms, interval }; timers.set(timer, timer); return timer; };
  const globals = {
    window, document, performance: { now: () => 100 }, Event, EventTarget, CustomEvent, DOMException, AbortController,
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: id => timers.delete(id),
  };
  return {
    ...globals, globals, timers, scripts, metrics,
    fire(ms, interval = false) {
      const timer = [...timers.values()].find(timer => timer.ms === ms && timer.interval === interval);
      assert.ok(timer, `expected ${ms}ms timer`);
      if (!interval) timers.delete(timer);
      timer.fn();
    },
  };
}
function load(path, env, modules) {
  const context = { ...env.globals, exports: {}, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
    if (Object.hasOwn(modules, name)) return modules[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(source(path), context, { filename: path });
  return context.exports;
}
function nativeFixture({ nativeHls = false, credentials = false, blocked = false } = {}) {
  const env = environment(), media = new EventTarget(), instances = [], progress = [];
  Object.assign(media, {
    currentTime: 0, duration: 100, paused: true, seeking: false, ended: false, error: null, src: '', blocked,
    canPlayType: () => nativeHls ? 'maybe' : '', load() {},
    removeAttribute(name) { if (name === 'src') this.src = ''; if (name === 'crossorigin') this.crossOrigin = null; },
    play() {
      if (this.blocked) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      this.paused = false;
      this.dispatchEvent(new Event('play'));
      this.reactOnPlay?.({ currentTarget: this });
      return Promise.resolve();
    },
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); this.reactOnPause?.({ currentTarget: this }); },
  });
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'quality', ERROR: 'error' };
    static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
    static isSupported() { return true; }
    constructor(config) {
      this.config = config; this.handlers = new Map(); this.calls = []; this.autoLevelEnabled = true;
      this.levels = [{ height: 360, bitrate: 800000 }, { height: 720, bitrate: 2500000 }]; instances.push(this);
    }
    on(event, handler) { this.handlers.set(event, handler); }
    emit(event, data) { this.handlers.get(event)?.(event, data); }
    loadSource(url) { this.url = url; }
    attachMedia(video) { this.media = video; }
    stopLoad() { this.calls.push('stop'); }
    startLoad() { this.calls.push('start'); }
    recoverMediaError() { this.calls.push('recover'); }
    destroy() { this.calls.push('destroy'); }
  }
  const engine = hooks(media);
  const metric = load('lib/player-metrics.ts', env, {});
  const { TrackedVideo } = load('components/TrackedVideo.tsx', env, { react: engine.react, 'hls.js': { __esModule: true, default: FakeHls }, '@/lib/player-metrics': metric });
  let props = { src: 'https://media.example/master.m3u8', sourceType: 'hls', withCredentials: credentials, startSeconds: 40, onPlay() {}, onEnded() {}, onProgress: (...sample) => progress.push(sample) };
  const render = (updates = {}) => {
    props = { ...props, ...updates };
    return engine.render(() => TrackedVideo(props), tree => {
      const video = find(tree, 'video'); media.reactOnPlay = video.props.onPlay; media.reactOnPause = video.props.onPause;
    });
  };
  render();
  return { ...env, media, instances, progress, render, cleanup: engine.cleanup };
}

test('native HLS uses credentials, restores position and records startup/rebuffering without leaking sources', () => {
  const fixture = nativeFixture({ nativeHls: true, credentials: true });
  try {
    assert.equal(fixture.instances.length, 0);
    assert.equal(fixture.media.crossOrigin, 'use-credentials');
    fixture.media.dispatchEvent(new Event('loadedmetadata'));
    assert.equal(fixture.media.currentTime, 40);
    fixture.media.dispatchEvent(new Event('playing'));
    assert.equal(fixture.metrics[0].name, 'startup');
    fixture.media.dispatchEvent(new Event('waiting'));
    fixture.media.dispatchEvent(new Event('playing'));
    assert.equal(fixture.metrics.at(-1).name, 'rebuffer');
    assert.equal(fixture.metrics.some(event => Object.values(event).some(value => typeof value === 'string' && value.includes('https:'))), false);
  } finally { fixture.cleanup(); }
  assert.equal(fixture.media.src, '');
  assert.equal(fixture.timers.size, 0);
  assert.ok(fixture.progress.some(sample => sample[0] === 40 && sample[2] === true));
});

test('autoplay rejection shows a working Play control; unresolved loading terminates after 20 seconds', async () => {
  const fixture = nativeFixture({ nativeHls: true, blocked: true });
  try {
    await turn();
    assert.equal(find(fixture.render(), 'button').props.children, 'Play video');
    fixture.media.blocked = false;
    find(fixture.render(), 'button').props.onClick();
    fixture.fire(20000);
    assert.equal(find(fixture.render(), 'button').props.children, 'Retry video');
    assert.equal(fixture.metrics.at(-1).code, 1);
  } finally { fixture.cleanup(); }
});

test('hls.js loads credentials, offers Auto/manual quality and bounds fatal media/network recovery', async () => {
  const fixture = nativeFixture({ credentials: true });
  try {
    await turn();
    const instance = fixture.instances[0], xhr = {};
    assert.ok(instance);
    instance.config.xhrSetup(xhr);
    assert.equal(xhr.withCredentials, true);
    instance.emit('manifest');
    find(fixture.render(), 'select').props.onChange({ target: { value: '1' } });
    assert.equal(instance.currentLevel, 1);
    find(fixture.render(), 'select').props.onChange({ target: { value: '-1' } });
    assert.equal(instance.currentLevel, -1);
    instance.emit('quality', { level: 1 });
    assert.equal(fixture.metrics.at(-1).height, 720);
    instance.emit('error', { fatal: true, type: 'network' }); fixture.fire(500);
    instance.emit('error', { fatal: true, type: 'network' }); fixture.fire(1000);
    assert.equal(instance.calls.filter(call => call === 'start').length, 2);
    instance.emit('error', { fatal: true, type: 'media' });
    assert.equal(instance.calls.at(-1), 'recover');
    instance.emit('error', { fatal: true, type: 'media' });
    assert.equal(find(fixture.render(), 'button').props.children, 'Retry video');
  } finally { fixture.cleanup(); }
  assert.equal(fixture.instances[0].calls.at(-1), 'destroy');
  assert.equal(fixture.timers.size, 0);
});

test('source cleanup sends final progress to the old source callback and removes stale listeners', () => {
  const fixture = nativeFixture({ nativeHls: true });
  const next = [];
  fixture.media.currentTime = 25;
  fixture.render({ src: 'https://media.example/new.mp4', sourceType: 'progressive', onProgress: (...sample) => next.push(sample) });
  assert.equal(fixture.progress.at(-1)[0], 25);
  assert.equal(next.length, 0);
  fixture.cleanup();
  const metrics = fixture.metrics.length;
  fixture.media.dispatchEvent(new Event('playing'));
  assert.equal(fixture.metrics.length, metrics);
});

test('player metrics accept only finite numeric fields', () => {
  const env = environment();
  load('lib/player-metrics.ts', env, {}).playbackMetric('startup', { duration_ms: 12.2, code: NaN, url: 'secret', token: 'secret' });
  assert.deepEqual(Object.keys(env.metrics[0]).sort(), ['duration_ms', 'name']);
  assert.equal(env.metrics[0].duration_ms, 12);
});

function youtubeFixture({ available = true } = {}) {
  const env = environment(), instances = [], samples = [], mount = { replaceChildren(...children) { this.children = children; } };
  let completions = 0;
  class Player {
    constructor(target, options) { this.options = options; this.plays = 0; this.position = 12; instances.push(this); }
    playVideo() { this.plays++; }
    seekTo(position) { this.seek = position; }
    getCurrentTime() { return this.position; }
    getDuration() { return 60; }
    destroy() { this.destroyed = true; }
  }
  if (available) env.window.YT = { Player };
  const engine = hooks(mount);
  const { TrackedYouTube } = load('components/TrackedYouTube.tsx', env, { react: engine.react });
  const render = () => engine.render(() => TrackedYouTube({ videoId: 'test-video', startSeconds: 8, onEnded: () => completions++, onProgress: (...sample) => samples.push(sample) }));
  render();
  return { ...env, instances, samples, render, cleanup: engine.cleanup, completions: () => completions };
}

test('YouTube Play/error events, one completion, recreate/retry and buffering deadline use SDK lifecycle', async () => {
  const fixture = youtubeFixture();
  try {
    await turn();
    const first = fixture.instances[0];
    first.options.events.onReady();
    assert.equal(first.seek, 8);
    first.options.events.onAutoplayBlocked();
    assert.equal(find(fixture.render(), 'button').props.children, 'Play video');
    find(fixture.render(), 'button').props.onClick();
    assert.equal(first.plays, 2);
    first.options.events.onStateChange({ data: 1 });
    first.options.events.onStateChange({ data: 0 });
    first.options.events.onStateChange({ data: 0 });
    assert.equal(fixture.completions(), 1);
    first.options.events.onError({ data: 100 });
    assert.match(find(fixture.render(), 'a').props.href, /youtube\.com/);
    find(fixture.render(), 'button').props.onClick(); fixture.render(); await turn();
    assert.equal(first.destroyed, true);
    const second = fixture.instances[1];
    second.options.events.onReady(); assert.equal(second.seek, 12);
    second.options.events.onStateChange({ data: 1 });
    second.options.events.onStateChange({ data: 3 });
    const deadline = [...fixture.timers.keys()].find(timer => timer.ms === 20000);
    second.options.events.onStateChange({ data: 3 });
    assert.ok(fixture.timers.has(deadline), 'repeated buffering must not reset deadline');
    fixture.fire(20000);
    assert.equal(find(fixture.render(), 'button').props.children, 'Retry video');
  } finally { fixture.cleanup(); }
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.instances.at(-1).destroyed, true);
});

test('failed YouTube API scripts can be retried and never leave an endless loader', async () => {
  const fixture = youtubeFixture({ available: false });
  try {
    fixture.scripts[0].dispatchEvent(new Event('error')); await turn();
    assert.equal(find(fixture.render(), 'button').props.children, 'Retry video');
    find(fixture.render(), 'button').props.onClick(); fixture.render();
    assert.equal(fixture.scripts.length, 2);
    fixture.scripts[1].dispatchEvent(new Event('error')); await turn();
    assert.equal(find(fixture.render(), 'button').props.children, 'Retry video');
  } finally { fixture.cleanup(); }
  assert.equal(fixture.timers.size, 0);
});

test('progress keeps episode selection, flushes latest throttled sample and isolates account/part writers', async () => {
  const env = environment(), engine = hooks(), values = new Map(), requests = [];
  let clock = 1000;
  const install = id => { values.set('access_token', token(id, 'access')); values.set('refresh_token', token(id, 'refresh')); };
  install(1);
  const localStorage = { getItem: key => values.get(key) ?? null };
  env.globals.localStorage = localStorage; env.globals.Date = { now: () => clock };
  const viewerRequest = async (id, config) => { requests.push({ id, config }); return { data: { position_seconds: 10, episode: config.params?.episode } }; };
  const { usePlaybackProgress } = load('hooks/usePlaybackProgress.ts', env, {
    react: engine.react, axios: { __esModule: true, default: { isAxiosError: () => false, isCancel: () => false } },
    '@/services/viewer-api': { viewerRequest, ViewerSessionChangedError: class extends Error {} },
    '@/lib/homepage-progress': {
      progressTokenBelongsToUser(value, id) { try { return String(jwtDecode(value).user_id) === String(id); } catch { return false; } },
      progressSample: (position, duration) => Number.isFinite(position) && Number.isFinite(duration) && position >= 0 && duration > 0 ? { position_seconds: Math.floor(Math.min(position, duration)), duration_seconds: Math.floor(duration) } : null,
    },
  });
  const render = (id = 1, episode = 11) => engine.render(() => usePlaybackProgress(id, 7, episode));
  const writes = () => requests.filter(request => request.config.method === 'POST');
  try {
    let progress = render(); await turn();
    assert.equal(requests[0].config.params.episode, 11);
    progress.record(10, 100); await turn();
    clock += 1000; progress.record(20, 100); clock += 1000; progress.record(25, 100); await turn();
    assert.equal(writes().length, 1);
    env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange')); await turn();
    assert.equal(writes().at(-1).config.data.position_seconds, 25);
    env.window.dispatchEvent(new Event('pagehide')); await turn(); assert.equal(writes().length, 2);
    progress = render(1, 12); progress.record(1, 100); await turn();
    assert.equal(writes().length, 3); assert.equal(writes().at(-1).config.data.episode, 12);
    clock += 1000; progress.record(5, 100); install(2); progress = render(2, 12); await turn();
    assert.equal(writes().length, 3, 'old account lifecycle sample must not be written');
    progress.record(15, 100); await turn();
    assert.equal(writes().at(-1).id, 2);
    assert.equal(writes().at(-1).config.data.position_seconds, 15);
    assert.equal(writes().at(-1).config.data.refresh, undefined);
  } finally { engine.cleanup(); await turn(); }
});
