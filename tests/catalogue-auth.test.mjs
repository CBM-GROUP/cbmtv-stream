import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, HOME_CATEGORIES, selectNewReleases, newestEligible } from "../src/lib/catalogue.ts";
import { playbackDestination, safeReturnTo, signInDestination } from "../src/lib/auth-return.ts";

const item = (id, content_type, channel, created_at, status = "approved") => ({
  id, content_type, channel, created_at, status, title: `Title ${id}`,
});

test("new releases select six recent approved additions without category or channel quotas", () => {
  const rows = [
    item(94, "original", 1, "2026-10-24"),
    item(93, "original", 8, "2026-10-18"),
    item(90, "movie", 1, "2026-10-20"),
    item(89, "movie", 9, "2026-10-19"),
    item(88, "series", 1, "2026-10-21"),
    item(87, "miniseries", 2, "2026-10-18"),
    item(86, "documentary", 1, "2026-10-22"),
    item(85, "documentary", 3, "2026-10-10", "preview"),
    item(84, "animations", 1, "2026-10-23"),
  ];
  assert.deepEqual(CATEGORIES.map(({ title }) => title), ["TV Shows", "Movies", "Series", "Animations", "Documentaries"]);
  assert.deepEqual(CATEGORIES.find(({ type }) => type === "series")?.types, ["series", "miniseries"]);
  assert.deepEqual(selectNewReleases([...rows, rows[0]]).map((row) => row.id), [94, 84, 86, 88, 90, 89]);
  assert.deepEqual(newestEligible([item(2, "movie", 1, "2026-10-20"), item(3, "movie", 1, "2026-10-20")]).map((row) => row.id), [3, 2]);
});

test("new releases handle small catalogues and do not manufacture category variety", () => {
  const rows = Array.from({ length: 8 }, (_, i) => item(i + 1, "movie", 1, `2026-10-${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(selectNewReleases(rows).map((row) => row.id), [8, 7, 6, 5, 4, 3]);
  assert.equal(selectNewReleases(rows.slice(0, 2)).length, 2);
  assert.deepEqual(selectNewReleases([item(1, "movie", 1, "2026-10-30", "preview")]), []);
});

test("sign-in return keeps only a known internal playback route", () => {
  assert.equal(playbackDestination(14, { episode: 23 }), "/programs/14?play=1&episode=23");
  assert.equal(safeReturnTo("//evil.test/programs/14?play=1"), "/");
  assert.equal(safeReturnTo("/programs/14?play=1&episode=23&next=https://evil.test"), "/programs/14?play=1&episode=23");
  assert.equal(safeReturnTo("/programs/14%2f..%2f15?play=1"), "/");
  assert.equal(signInDestination("/programs/14?play=1"), "/sign-in?returnTo=%2Fprograms%2F14%3Fplay%3D1");
});

test("home keeps all episodic formats in TV Shows without changing browse filters", () => {
  assert.deepEqual(HOME_CATEGORIES.map(({ title }) => title), ["Movies", "TV Shows", "Documentaries", "Animations"]);
  assert.deepEqual(HOME_CATEGORIES.find(({ title }) => title === "TV Shows").types, ["original", "series", "miniseries"]);
  assert.deepEqual(CATEGORIES.find(({ type }) => type === "original").types, ["original"]);
  assert.deepEqual(HOME_CATEGORIES.flatMap(({ types }) => types).sort(), CATEGORIES.flatMap(({ types }) => types).sort());
});
