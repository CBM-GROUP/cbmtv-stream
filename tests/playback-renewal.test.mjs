import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(new URL('../src/hooks/useAuthorizedPlayback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const turn = () => new Promise(resolve => setImmediate(resolve));

test('transient grant renewal failure keeps playback mounted and retries', async () => {
  const slots = [], effects = [], timers = new Map(), requests = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const first = { url: 'https://cdn.example/attempt/master.m3u8', type: 'hls',
    with_credentials: true, session_id: 'fixture-session', expires_at: new Date(Date.now() + 120000).toISOString() };
  const responses = [{ data: first }, new Error('temporary network outage'), { data: first }];
  const context = { exports: {}, AbortController, Date,
    setTimeout(fn, ms) { const id = Symbol(); timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return react;
      if (name === 'axios') return { isAxiosError: () => false };
      if (name === '@/services/viewer-api') return { viewerRequest: async (_id, options) => {
        requests.push(options);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      } };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  const render = () => {
    cursor = 0;
    const result = context.exports.useAuthorizedPlayback(1, 2, undefined, undefined, true);
    effects.splice(0).forEach(effect => effect());
    return result;
  };
  const fire = () => {
    const [id, timer] = [...timers.entries()][0];
    assert.ok(timer);
    timers.delete(id);
    timer.fn();
    return timer.ms;
  };
  render();
  await turn();
  assert.equal(render().grant.url, first.url);
  fire();
  await turn();
  assert.equal(render().grant.url, first.url);
  assert.equal(render().message, undefined);
  assert.equal(fire(), 5000);
  await turn();
  assert.equal(render().grant.url, first.url);
  assert.equal(requests[2].data.session_id, 'fixture-session');
  slots.forEach(slot => slot.cleanup?.());
});
