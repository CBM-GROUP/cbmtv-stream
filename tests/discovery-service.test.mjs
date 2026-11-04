import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/services/discovery.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function fixture(authenticated = false) {
  const posts = [], gets = [], ownerRequests = [];
  const publicApiClient = {
    get: async (path, config) => { gets.push({ path, config }); return { data: { items: [{ id: 7 }], receipt: 'signed-search' } }; },
    post: async (path, payload) => { posts.push({ path, payload, authenticated: false }); return { data: { accepted: true } }; },
  };
  const apiClient = {
    post: async (path, payload) => { posts.push({ path, payload, authenticated: true }); return { data: { accepted: true } }; },
  };
  const modules = {
    './api': { __esModule: true, default: apiClient, publicApiClient },
    './viewer-api': { viewerRequest: async (id, config) => { ownerRequests.push({ id, config }); return { data: { items: [], personalized: true } }; } },
    './search': { searchContent: async () => ({ receipt: 'signed-search' }) },
  };
  const context = { exports: {}, Date, crypto: globalThis.crypto,
    localStorage: { getItem: key => key === 'access_token' && authenticated ? 'viewer-token' : null },
    require(name) { if (Object.hasOwn(modules, name)) return modules[name]; throw new Error(`Unexpected module ${name}`); },
  };
  vm.runInNewContext(source, context, { filename: 'discovery.ts' });
  return { service: context.exports, posts, gets, ownerRequests };
}

test('an explicit anonymous search sends one submission and attributes only its selected title', async () => {
  const { service, posts } = fixture();
  const searchId = await service.submitSearchEvent('Ocean', 'title', 'signed-search');
  assert.ok(searchId);
  assert.equal(await service.submitSearchEvent('Ocean', 'title', 'signed-search'), searchId);
  await service.recordSearchSelection('Ocean', 'title', 7, 'signed-search');
  assert.deepEqual(posts.map(row => row.payload.type), ['search_submitted', 'search_selected']);
  assert.equal(posts[1].payload.search_id, searchId);
  assert.equal(posts[1].payload.content, 7);
  assert.ok(posts.every(row => !row.authenticated));
});

test('authenticated recommendation uses viewer-scoped request and playback events use the bearer client', async () => {
  const { service, posts, ownerRequests } = fixture(true);
  const result = await service.getRecommended(42);
  assert.equal(result.personalized, true);
  assert.equal(ownerRequests[0].id, 42);
  assert.equal(ownerRequests[0].config.url, '/api/discovery/recommended/');
  await service.recordPlaybackEvent('playback_started', 'grant-session', 0, 120);
  assert.equal(posts[0].authenticated, true);
  assert.equal(posts[0].payload.session_id, 'grant-session');
  assert.equal(await service.recordPlaybackEvent('playback_progress', 'grant-session', 10, NaN), false);
  assert.equal(posts.length, 1);
});

test('public rankings and similar titles request bounded results', async () => {
  const { service, gets } = fixture();
  await service.getRanking('trending');
  await service.getSimilar(7);
  assert.deepEqual(gets.map(row => row.path), ['/api/discovery/rankings/trending/', '/api/discovery/similar/7/']);
  assert.ok(gets.every(row => row.config.params.limit === 12));
});

test('discovery rails keep personalized requests disabled for anonymous viewers and label cold starts honestly', () => {
  const railsSource = ts.transpileModule(readFileSync(new URL('../src/components/DiscoveryRails.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const render = user => {
    const queries = [];
    const modules = {
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      '@tanstack/react-query': { useQuery: options => { queries.push(options); return { data: { items: [], personalized: false }, isPending: false, isError: false, refetch() {} }; } },
      '@/context/AuthContext': { useAuth: () => ({ user, loading: false }) },
      '@/services/discovery': { getRanking() {}, getRecommended() {} },
      './ContentRail': { ContentRail: 'ContentRail' },
    };
    const context = { exports: {}, require(name) { return modules[name]; } };
    vm.runInNewContext(railsSource, context);
    const tree = context.exports.DiscoveryRails();
    const children = Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children];
    return { queries, children: children.filter(Boolean) };
  };
  const anonymous = render(null);
  assert.equal(anonymous.queries[2].enabled, false);
  assert.equal(anonymous.children.length, 2);
  const signedIn = render({ id: 42 });
  assert.equal(signedIn.queries[2].enabled, true);
  assert.equal(signedIn.children[2].props.title, 'Explore for You');
});
