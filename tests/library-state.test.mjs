import assert from 'node:assert/strict';
import test from 'node:test';
import { publicProgress, publicSaved, withProgress, withSaved, withoutSaved } from '../src/lib/library-state.ts';

const title = (id, status = 'approved') => ({ id, status, title: `Title ${id}` });
const saved = (id, status = 'approved') => ({ id, content: title(id, status) });
const progress = (id, completed = false, status = 'approved') => ({ id, content: title(id, status), completed });

test('saved titles exclude unavailable and unpublished content', () => {
  assert.deepEqual(publicSaved([saved(1), saved(2, 'preview'), { id: 3, content: null }]).map((row) => row.id), [1]);
});

test('successful save and removal keep one card per content id', () => {
  const first = saved(1);
  const updated = { ...saved(1), id: 99 };
  assert.deepEqual(withSaved([first], updated).map((row) => row.id), [99]);
  assert.deepEqual(withoutSaved([first], 1), []);
});

test('continue watching excludes completed or unpublished content', () => {
  assert.deepEqual(publicProgress([progress(1), progress(2, true), progress(3, false, 'preview')]).map((row) => row.id), [1]);
  assert.deepEqual(withProgress([progress(1)], progress(1, true)), []);
  assert.deepEqual(withProgress([progress(1)], { ...progress(1), id: 90 }).map((row) => row.id), [90]);
});
