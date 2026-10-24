import assert from "node:assert/strict";
import test from "node:test";

import { initialPlayback, playbackTransition } from "../src/lib/playback-flow.ts";

const trailer = "https://cdn.example/trailer.mp4";
const movie = "https://cdn.example/movie.mp4";

test("movie without a trailer is selected immediately", () => {
  assert.deepEqual(initialPlayback(null, movie), { phase: "main", url: movie, session: 0 });
});

test("movie starts before its optional trailer", () => {
  assert.deepEqual(initialPlayback(trailer, movie), { phase: "main", url: movie, session: 0 });
});

test("trailer can be selected and its completion returns to the movie once", () => {
  const opened = initialPlayback(trailer, movie);
  const preview = playbackTransition(opened, { type: "playTrailer", url: trailer });
  assert.deepEqual(preview, { phase: "trailer", url: trailer, session: 1 });
  const main = playbackTransition(preview, { type: "trailerFinished", main: movie });
  assert.deepEqual(main, { phase: "main", url: movie, session: 2 });
  assert.equal(playbackTransition(main, { type: "trailerFinished", main: movie }), main);
});

test("trailer remains playable when no main video exists", () => {
  assert.deepEqual(initialPlayback(trailer, null), { phase: "trailer", url: trailer, session: 0 });
});

test("movie completion does not replay the trailer", () => {
  const main = initialPlayback(null, movie);
  const ended = playbackTransition(main, { type: "ended" });
  assert.deepEqual(ended, { phase: "ended", url: movie, session: 0 });
  assert.deepEqual(playbackTransition(ended, { type: "playing" }), main);
});
