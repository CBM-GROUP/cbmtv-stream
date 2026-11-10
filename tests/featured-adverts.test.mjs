import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/featured-adverts.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, require: () => { throw new Error('Unexpected runtime import'); } };
vm.runInNewContext(code, context);
const { insertFeaturedAdverts, reconcileFeaturedIndex } = context.exports;
const movies = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, title: `Movie ${index + 1}`, content_type: 'movie' }));
const selected = new Map(Array.from({ length: 6 }, (_, index) => [index + 1, { session: { session: 'viewer' }, ad: { decision_id: `ad-${index + 1}` } }]));

test('featured adverts follow each positive interval without reordering movies', () => {
  for (const interval of [1, 2, 3]) {
    const slides = insertFeaturedAdverts(movies, selected, interval);
    assert.deepEqual(Array.from(slides.filter(slide => slide.kind === 'movie'), slide => slide.movie.id), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(Array.from(slides.filter(slide => slide.kind === 'advert'), slide => slide.after),
      interval === 1 ? [1, 2, 3, 4, 5, 6] : interval === 2 ? [2, 4, 6] : [3, 6]);
  }
});

test('missing eligible adverts leave no empty slides', () => {
  const slides = insertFeaturedAdverts(movies, new Map([[3, selected.get(3)]]), 3);
  assert.deepEqual(Array.from(slides, slide => slide.kind === 'movie' ? slide.movie.id : 'advert'), [1, 2, 3, 'advert', 4, 5, 6]);
  assert.equal(insertFeaturedAdverts(movies, new Map(), 3).length, movies.length);
});

test('interval beyond the movie count leaves the complete movie sequence intact', () => {
  const slides = insertFeaturedAdverts(movies, selected, movies.length + 1);
  assert.deepEqual(Array.from(slides, slide => slide.movie.id), [1, 2, 3, 4, 5, 6]);
});

test('episodic featured titles keep their place without advancing the movie interval', () => {
  const titles = [movies[0], { id: 99, title: 'Series', content_type: 'tv_show' }, movies[1], movies[2]];
  const slides = insertFeaturedAdverts(titles, selected, 2);
  assert.deepEqual(Array.from(slides, slide => slide.kind === 'movie' ? slide.movie.id : 'advert'), [1, 99, 2, 'advert', 3]);
});

test('active movie and advert follow their identity when the slide sequence changes', () => {
  const ordinary = insertFeaturedAdverts(movies.slice(0, 3), new Map(), 1);
  const sponsored = insertFeaturedAdverts(movies.slice(0, 3), selected, 1);
  assert.equal(reconcileFeaturedIndex(ordinary, sponsored, 1), 2);
  assert.equal(reconcileFeaturedIndex(sponsored, ordinary, 2), 1);
  assert.equal(reconcileFeaturedIndex(sponsored, ordinary, 3), 2);
  assert.equal(reconcileFeaturedIndex(sponsored, [], 5), 0);
});
