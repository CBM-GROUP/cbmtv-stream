import assert from 'node:assert/strict';
import test from 'node:test';
import { initialPlayback, playbackTransition } from '../src/lib/playback-flow.ts';
const trailer = 'https://cdn.example/trailer.mp4', movie = 'https://cdn.example/movie.mp4';
test('fresh viewing starts the trailer; a title without a trailer starts its main source', () => {
  assert.equal(initialPlayback(trailer, movie).phase, 'trailer');
  assert.equal(initialPlayback(null, movie).url, movie);
});
test('saved progress and an explicit episode skip the trailer', () => {
  const state = initialPlayback(trailer, movie, { resumeAt: 25 });
  assert.equal(state.kind, 'main'); assert.equal(state.resumeAt, 25);
  assert.equal(initialPlayback(trailer, movie, { skipTrailer: true }).url, movie);
  assert.equal(initialPlayback(trailer, movie, { resumeAt: NaN }).kind, 'trailer');
});
test('trailer completion, skip and failure transition to main exactly once', () => {
  for (const type of ['trailerFinished', 'trailerFailed']) {
    const main = playbackTransition(initialPlayback(trailer, movie), { type, main: movie });
    assert.equal(main.kind, 'main'); assert.equal(main.url, movie); assert.equal(main.session, 1);
    assert.equal(playbackTransition(main, { type, main: movie }), main);
  }
});
test('trailer-only titles finish without a replay loop', () => {
  const ended = playbackTransition(initialPlayback(trailer, null), { type: 'trailerFinished', main: null });
  assert.equal(ended.phase, 'ended'); assert.equal(ended.kind, 'trailer');
  assert.equal(playbackTransition(ended, { type: 'trailerFinished', main: null }), ended);
});
test('main completion and replay never reinsert the trailer', () => {
  const main = initialPlayback(null, movie), ended = playbackTransition(main, { type: 'ended' });
  assert.equal(ended.phase, 'ended'); assert.equal(ended.kind, 'main');
  assert.deepEqual(playbackTransition(ended, { type: 'playing' }), main);
  const replay = playbackTransition(ended, { type: 'playMain', url: movie });
  assert.equal(replay.session, 1); assert.equal(replay.resumeAt, 0);
});
test('repeated play clicks do not create another playback session', () => {
  const main = initialPlayback(null, movie), preview = initialPlayback(trailer, movie);
  assert.equal(playbackTransition(main, { type: 'playMain', url: movie }), main);
  assert.equal(playbackTransition(preview, { type: 'playTrailer', url: trailer }), preview);
});
test('two different episodes sharing a URL still receive distinct explicit sessions', () => {
  const main = initialPlayback(null, movie);
  const episode = playbackTransition(main, { type: 'playMain', url: movie, force: true });
  assert.equal(episode.session, main.session + 1); assert.equal(episode.resumeAt, 0);
});
test('a manually selected trailer returns to the main viewing position', () => {
  const main = playbackTransition(initialPlayback(trailer, movie), { type: 'trailerFinished', main: movie, resumeAt: 18 });
  assert.equal(main.resumeAt, 18); assert.equal(main.kind, 'main');
});
