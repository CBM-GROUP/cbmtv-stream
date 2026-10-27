import assert from "node:assert/strict";
import test from "node:test";
import { selectNewReleases, newestEligible } from "../src/lib/catalogue.ts";
import { playbackDestination, safeReturnTo, signInDestination } from "../src/lib/auth-return.ts";

const item = (id, content_type, channel, created_at, status = "approved") => ({
  id, content_type, channel, created_at, status, title: `Title ${id}`,
});

test("new releases choose one approved item per category, preferring another channel", () => {
  const rows = [
    item(90, "movie", 1, "2026-10-20"),
    item(89, "movie", 9, "2026-10-19"),
    item(88, "series", 1, "2026-10-21"),
    item(87, "series", 2, "2026-10-18"),
    item(86, "documentary", 1, "2026-10-22"),
    item(85, "documentary", 3, "2026-10-10", "preview"),
    item(84, "animations", 1, "2026-10-23"),
  ];
  assert.deepEqual(selectNewReleases([...rows, rows[0]]).map((row) => row.id), [90, 87, 86, 84]);
  assert.deepEqual(newestEligible([item(2, "movie", 1, "2026-10-20"), item(3, "movie", 1, "2026-10-20")]).map((row) => row.id), [3, 2]);
});

test("sign-in return keeps only a known internal playback route", () => {
  assert.equal(playbackDestination(14, { episode: 23 }), "/programs/14?play=1&episode=23");
  assert.equal(safeReturnTo("//evil.test/programs/14?play=1"), "/");
  assert.equal(safeReturnTo("/programs/14?play=1&episode=23&next=https://evil.test"), "/programs/14?play=1&episode=23");
  assert.equal(safeReturnTo("/programs/14%2f..%2f15?play=1"), "/");
  assert.equal(signInDestination("/programs/14?play=1"), "/sign-in?returnTo=%2Fprograms%2F14%3Fplay%3D1");
});
