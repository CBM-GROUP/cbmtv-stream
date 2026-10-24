import assert from "node:assert/strict";
import test from "node:test";

import { initialPlayback, playbackTransition } from "../src/lib/playback-flow.ts";

const trailer = "https://cdn.example/trailer.mp4";
const movie = "https://cdn.example/movie.mp4";

test("movie without a trailer is selected immediately", () => {
  assert.deepEqual(initialPlayback(null, movie), { phase: "main", url: movie, session: 0 });
});

test("trailer completion and Skip both start the movie once", () => {
  const opened = initialPlayback(trailer, movie);
  const main = playbackTransition(opened, { type: "trailerFinished", main: movie });
  assert.deepEqual(main, { phase: "main", url: movie, session: 1 });
  assert.equal(playbackTransition(main, { type: "trailerFinished", main: movie }), main);
});

test("movie completion does not replay the trailer", () => {
  const main = initialPlayback(null, movie);
  const ended = playbackTransition(main, { type: "ended" });
  assert.deepEqual(ended, { phase: "ended", url: movie, session: 0 });
  assert.deepEqual(playbackTransition(ended, { type: "playing" }), main);
});
