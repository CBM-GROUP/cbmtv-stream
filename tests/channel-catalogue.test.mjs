import assert from "node:assert/strict";
import test from "node:test";
import { buildChannelCatalogue } from "../src/lib/catalogue.ts";

const item = (id, type, overrides = {}) => ({
  id, title: `Title ${id}`, content_type: type, channel: 1,
  created_at: `2026-10-${String(id).padStart(2, "0")}`, status: "approved",
  ...overrides,
});

test("channel sections group episodic formats and hide empty categories", () => {
  const rows = [item(1, "movie"), item(2, "original"), item(3, "series"), item(4, "miniseries"), item(5, "documentary"), item(6, "animations")];
  const result = buildChannelCatalogue([...rows, rows[0]]);
  assert.deepEqual(result.sections.map(({ title }) => title), ["TV Shows", "Movies", "Documentaries", "Animations"]);
  assert.deepEqual(result.sections[0].items.map(({ id }) => id), [4, 3, 2]);
  assert.equal(result.published.length, 6);
  assert.deepEqual(buildChannelCatalogue([rows[0]]).sections.map(({ title }) => title), ["Movies"]);
  assert.deepEqual(buildChannelCatalogue([]).sections, []);
});

test("unpublished records never appear in categories, featured or recently added", () => {
  const rows = [item(1, "movie", { is_featured: true }), ...["preview", "rejected", "comingsoon", null].map((status, i) => item(i + 2, "movie", { status, is_featured: true }))];
  const result = buildChannelCatalogue(rows);
  for (const section of [...result.sections, { items: result.featured }, { items: result.recent }]) {
    assert.deepEqual(section.items.map(({ id }) => id), [1]);
  }
});

test("featured content uses the editorial flag rather than recency", () => {
  const result = buildChannelCatalogue([item(1, "movie", { is_featured: true }), item(2, "movie"), item(3, "movie", { is_featured: false })]);
  assert.deepEqual(result.featured.map(({ id }) => id), [1]);
  assert.deepEqual(result.recent.map(({ id }) => id), [3, 2, 1]);
});

test("a shared endpoint record retains its ID and is not rejected by its scalar channel field", () => {
  const shared = Object.freeze(item(1, "movie", { channel: 7 }));
  const channelOne = buildChannelCatalogue([shared, shared]);
  const channelTwo = buildChannelCatalogue([shared]);
  assert.equal(channelOne.sections[0].items[0], shared);
  assert.equal(channelTwo.sections[0].items[0], shared);
  assert.equal(channelOne.published.length, 1);
  assert.equal(shared.channel, 7);
});

test("classifications outside the primary four remain discoverable without relabeling", () => {
  const music = item(1, "music");
  const unknown = item(2, "future-type");
  const result = buildChannelCatalogue([music, unknown]);
  assert.deepEqual(result.sections, []);
  assert.deepEqual(result.other.map(({ content_type }) => content_type), ["future-type", "music"]);
  assert.equal(result.recent.length, 2);
});

test("recently added is bounded without truncating the category catalogue", () => {
  const result = buildChannelCatalogue(Array.from({ length: 20 }, (_, i) => item(i + 1, "movie")));
  assert.equal(result.recent.length, 12);
  assert.equal(result.recent[0].id, 20);
  assert.equal(result.sections[0].items.length, 20);
});
