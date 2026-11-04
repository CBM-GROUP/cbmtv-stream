import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = path => ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const componentSource = compile('components/ProgramDetail.tsx');
const flowContext = { exports: {} };
vm.runInNewContext(compile('lib/playback-flow.ts'), flowContext);
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(accept => { resolve = accept; }); return { promise, resolve }; }
function descendants(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}
const text = node => descendants(node).filter(value => typeof value === 'string' || typeof value === 'number').join(' ');
const find = (tree, type) => descendants(tree).find(node => node?.type === type);
const button = (tree, label) => descendants(tree).find(node => ['button', 'Button'].includes(node?.type) && text(node.props.children).trim() === label);

// Execute the real detail component with controlled hooks and service boundaries.
// These are component coordination tests, not browser/media decoder verification.
function fixture({ episodic = false, trailer = true, snapshot = null, intent, holdEpisodes = false, failEpisodes = false } = {}) {
  const slots = [], effects = [], authorizationCalls = [], progressCalls = [], records = [], trace = [], timers = new Map();
  let cursor = 0, dirty = false;
  const changed = (old, deps) => !old || deps.some((value, index) => !Object.is(value, old.deps[index]));
  const memo = (fn, deps) => {
    const index = cursor++, old = slots[index];
    if (changed(old, deps)) slots[index] = { value: fn(), deps };
    return slots[index].value;
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (changed(old, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    },
  };
  const episodesGate = deferred(), histories = new Map();
  const program = { id: 7, title: 'Fixture title', description: 'Fixture synopsis', content_type: episodic ? 'series' : 'movie', format: episodic ? 'series' : 'standalone', trailer_link: trailer ? 'https://media.example/trailer.mp4' : null, streaming_link: null, playback_available: true, genre: '', channel: 1 };
  const state = {
    auth: { user: { id: 1 }, loading: false }, ready: true, snapshot, failEpisodes,
    episodes: [{ id: 11, title: 'Episode one', episode_number: 1, playback_available: true }, { id: 12, title: 'Episode two', episode_number: 2, playback_available: true }],
    grantUrl: null, grantType: 'hls',
  };
  const window = Object.assign(new EventTarget(), { localStorage: { getItem: () => null, setItem() {} }, location: { href: 'https://viewer.example/programs/7' }, setInterval, clearInterval });
  const document = new EventTarget();
  const services = {
    getSeriesSeasons: async () => [{ id: 2, season_number: 1, title: 'Season one' }],
    getSeasonEpisodes: async () => {
      if (state.failEpisodes) throw new Error('Fixture episode service unavailable');
      return holdEpisodes ? episodesGate.promise : state.episodes;
    },
    getMiniSeriesParts: async () => [],
  };
  const modules = {
    react,
    '@/components/SeasonsAccordion': { __esModule: true, default: 'SeasonsAccordion' },
    '@/components/SafeImage': { SafeImage: 'SafeImage' }, '@/components/ui/button': { Button: 'Button' },
    '@/hooks/useContent': { useContent: () => ({ data: [] }) }, '@/services/series': services,
    'lucide-react': { ChevronRight: 'ChevronRight' }, 'next/link': { __esModule: true, default: 'Link' },
    './ProgramCard': { ProgramCard: 'ProgramCard' }, './TrackedVideo': { TrackedVideo: 'TrackedVideo' },
    './TrackedYouTube': { TrackedYouTube: 'TrackedYouTube' }, './PlayerOptions': { PlayerOptions: 'PlayerOptions' },
    '@/lib/playback-flow': flowContext.exports, '@/context/AuthContext': { useAuth: () => state.auth },
    '@/hooks/usePlaybackProgress': { usePlaybackProgress: (id, content, episode, miniseries) => {
      progressCalls.push({ id, content, episode, miniseries });
      const selected = episode || miniseries;
      return { progress: selected ? histories.get(`${id}:${episode ?? ''}:${miniseries ?? ''}`) ?? null : state.snapshot, ready: state.ready, error: false, retry() {}, record: (...values) => records.push({ id, content, values }) };
    } },
    '@/lib/homepage-progress': { resumePosition: (progress, episode, miniseries) => progress && !progress.completed && (progress.episode ?? undefined) === episode && (progress.miniseries ?? undefined) === miniseries ? progress.position_seconds : 0 },
    '@/hooks/useAuthorizedPlayback': { useAuthorizedPlayback: (id, content, episode, miniseries, enabled) => {
      authorizationCalls.push({ id, content, episode, miniseries, enabled });
      return { grant: enabled && id ? { url: state.grantUrl ?? `https://media.example/${episode ?? miniseries ?? 'movie'}.m3u8`, type: state.grantType, with_credentials: true } : undefined, retry() {} };
    } },
    '@/lib/auth-return': { playbackDestination: id => `/programs/${id}?play=1`, signInDestination: route => `/sign-in?returnTo=${encodeURIComponent(route)}` },
  };
  const context = { exports: {}, window, document, URL,
    setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.set(timer, timer); return timer; },
    clearTimeout: timer => timers.delete(timer), console, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'fragment' };
    if (Object.hasOwn(modules, name)) return modules[name];
    throw new Error(`Unexpected dependency ${name}`);
  } };
  vm.runInNewContext(componentSource, context, { filename: 'ProgramDetail.tsx' });
  const render = () => {
    let tree;
    for (let count = 0; count < 30; count++) {
      dirty = false; cursor = 0;
      tree = context.exports.default({ program, intent }); trace.push(tree);
      effects.splice(0).forEach(run => run());
      if (!dirty) return tree;
    }
    throw new Error('Component failed to settle');
  };
  const settle = async () => { await turn(); render(); await turn(); return render(); };
  return { state, program, histories, trace, render, settle, authorizationCalls, progressCalls, records,
    expireEpisodes: () => { const deadline = [...timers.values()].find(timer => timer.ms === 20000); assert.ok(deadline); timers.delete(deadline); deadline.fn(); },
    resolveEpisodes: () => episodesGate.resolve(state.episodes), cleanup: () => slots.forEach(slot => slot.cleanup?.()) };
}

test('fast trailer Skip waits for episodic data and starts the first available episode', async () => {
  const page = fixture({ episodic: true, holdEpisodes: true });
  try {
    let tree = page.render();
    assert.equal(find(tree, 'TrackedVideo').props.src, page.program.trailer_link);
    button(tree, 'Skip').props.onClick(); tree = page.render();
    assert.equal(find(tree, 'TrackedVideo'), undefined);
    assert.equal(page.authorizationCalls.some(call => call.enabled), false);
    page.resolveEpisodes(); tree = await page.settle();
    const player = find(tree, 'TrackedVideo'); assert.ok(player);
    assert.match(player.props.src, /11\.m3u8$/);
    player.props.onProgress(8, 100, true);
    assert.equal(page.records.at(-1).values[2], 11);
    assert.equal(page.progressCalls.at(-1).episode, 11);
  } finally { page.cleanup(); }
});

test('missing requested episodes and failed episode loads give actionable states', async () => {
  const missing = fixture({ episodic: true, intent: { play: true, episode: 99 } });
  try {
    missing.render(); const tree = await missing.settle();
    assert.equal(find(tree, 'TrackedVideo'), undefined);
    assert.match(text(tree), /requested episode or part is unavailable/);
  } finally { missing.cleanup(); }
  const failed = fixture({ episodic: true, failEpisodes: true, intent: { play: true } });
  try {
    failed.render(); let tree = await failed.settle();
    assert.match(text(tree), /Couldn't load episodes/);
    assert.ok(button(tree, 'Retry episodes'));
    failed.state.failEpisodes = false; button(tree, 'Retry episodes').props.onClick(); failed.render(); tree = await failed.settle();
    assert.match(find(tree, 'TrackedVideo').props.src, /11\.m3u8$/);
  } finally { failed.cleanup(); }
});

test('a stalled episode request reaches a retry state after the loading deadline', () => {
  const page = fixture({ episodic: true, holdEpisodes: true, intent: { play: true } });
  try {
    page.render(); page.expireEpisodes(); const tree = page.render();
    assert.ok(button(tree, 'Retry episodes'));
    assert.equal(find(tree, 'TrackedVideo'), undefined);
  } finally { page.cleanup(); }
});

test('initial progress restoration never mounts a trailer before resuming; manual trailer remains available', async () => {
  const page = fixture({ snapshot: { position_seconds: 31, completed: false, episode: null, miniseries: null } });
  try {
    page.state.ready = false; page.render();
    assert.equal(page.trace.some(tree => find(tree, 'TrackedVideo')), false);
    page.state.ready = true; let tree = page.render();
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 31);
    assert.equal(page.trace.some(tree => find(tree, 'TrackedVideo')?.props.src === page.program.trailer_link), false);
    button(tree, 'Watch trailer').props.onClick(); tree = page.render();
    assert.equal(find(tree, 'TrackedVideo').props.src, page.program.trailer_link);
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 0);
  } finally { page.cleanup(); }
});

test('progressive authorization renewal preserves the live playhead but account switching resets it', () => {
  const page = fixture({ trailer: false, snapshot: { position_seconds: 12, completed: false, episode: null, miniseries: null } });
  try {
    page.state.grantType = 'progressive'; page.state.grantUrl = 'https://media.example/movie.mp4?signature=first';
    let player = find(page.render(), 'TrackedVideo'); assert.equal(player.props.startSeconds, 12);
    player.props.onProgress(66, 100);
    const oldKey = player.key;
    page.state.grantUrl = 'https://media.example/movie.mp4?signature=renewed'; player = find(page.render(), 'TrackedVideo');
    assert.notEqual(player.key, oldKey); assert.equal(player.props.startSeconds, 66);
    page.state.auth = { user: { id: 2 }, loading: false };
    page.state.snapshot = { position_seconds: 4, completed: false, episode: null, miniseries: null };
    player = find(page.render(), 'TrackedVideo'); assert.equal(player.props.startSeconds, 4);
  } finally { page.cleanup(); }
});

test('part switches restore that part history and ignore stale old-part playhead samples', async () => {
  const page = fixture({ episodic: true, snapshot: { episode: 11, miniseries: null, position_seconds: 50, completed: false } });
  page.histories.set('1:11:', { episode: 11, miniseries: null, position_seconds: 50, completed: false });
  page.histories.set('1:12:', { episode: 12, miniseries: null, position_seconds: 8, completed: false });
  try {
    page.render(); let tree = await page.settle();
    const old = find(tree, 'TrackedVideo'); assert.equal(old.props.startSeconds, 50);
    find(tree, 'SeasonsAccordion').props.onEpisodeSelect(page.state.episodes[1]); tree = page.render();
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 8);
    old.props.onProgress(80, 100, true);
    page.state.grantUrl = 'https://media.example/episode12.m3u8?renewed'; tree = page.render();
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 8);
  } finally { page.cleanup(); }
});

test('completed episode snapshots advance to the next available episode without replaying the trailer', async () => {
  const page = fixture({ episodic: true, snapshot: { episode: 11, miniseries: null, position_seconds: 100, completed: true } });
  try {
    page.render(); const tree = await page.settle();
    assert.match(find(tree, 'TrackedVideo').props.src, /12\.m3u8$/);
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 0);
    assert.equal(page.trace.some(tree => find(tree, 'TrackedVideo')?.props.src === page.program.trailer_link), false);
    assert.equal(page.records.length, 0);
  } finally { page.cleanup(); }
});

test('completed final episodes remain episode-specific and explicit episode requests can replay', async () => {
  const snapshot = { episode: 12, miniseries: null, position_seconds: 100, completed: true };
  const final = fixture({ episodic: true, snapshot });
  final.histories.set('1:12:', snapshot);
  try {
    final.render(); let tree = await final.settle();
    assert.equal(find(tree, 'TrackedVideo'), undefined);
    assert.match(text(tree), /finished this episode/);
    assert.equal(final.records.length, 0, 'opening a completed episode must not complete a series');
    button(tree, 'Watch now').props.onClick(); tree = final.render();
    assert.match(find(tree, 'TrackedVideo').props.src, /12\.m3u8$/);
    assert.equal(find(tree, 'TrackedVideo').props.startSeconds, 0);
  } finally { final.cleanup(); }
  const explicit = fixture({ episodic: true, snapshot, intent: { play: true, episode: 12 } });
  explicit.histories.set('1:12:', snapshot);
  try {
    explicit.render(); const tree = await explicit.settle();
    assert.match(find(tree, 'TrackedVideo').props.src, /12\.m3u8$/);
  } finally { explicit.cleanup(); }
});
