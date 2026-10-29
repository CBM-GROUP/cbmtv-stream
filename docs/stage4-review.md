# CBM TV Stage 4 — search completeness and discovery review

30 October 2026. Frontend changes are submitted for review and remain unmerged.

## Search keeps its existing interface

The existing compact header icon, search sheet, white result list, focus behavior and keyboard selection are retained. The catalogue page keeps its existing presentation. No full-page search redesign or new filter panel remains.

The popup still starts with eight matches. Further matches append inside the same scrolling list, automatically near its end or through a small Load more results action. A continuation failure keeps the loaded results and offers an explicit retry. Empty queries send no search request; debouncing, cancellation and caching remain in use. Legacy backend responses without continuation fields remain supported.

## Verified completeness bug and repair

A read-only live audit found eight approved catalogue titles. Full-title searches found seven. **The Bigger Dream, ID 10, was absent from its own full-title search**, which instead returned IDs 12, 11 and 13 from Meilisearch. Dear Dija and Queen of Katwe were discoverable only through database fallback, so successful search alone did not prove index coverage.

The backend used its database fallback only when every index result was absent. A partially populated/stale index could therefore hide a valid published title. The popup also stopped at eight results, while the API stopped at 100 and supplied no continuation.

The approved local repair:

- Exact current published titles are discoverable even if missing from Meilisearch, and appear before weaker matches.
- Current database matches always supplement index results. Meilisearch relevance and typo matching remain in use; results are hydrated from approved database records and deduplicated.
- Public title, description, genre, channel name, director, writer, country and stored category are searched. Query words can match across those fields. Canonical category words do not reclassify the returned records.
- The existing GET endpoint accepts an optional non-negative `offset`. `limit` remains a per-page limit capped at 100. Existing `query`, `hits`, `count` and `source` fields are preserved; `total`, `offset` and `next_offset` are additive.
- Database matching pages have no 100-result ceiling. Only the selected result page is serialized. Ranked index retrieval requests IDs rather than full documents.

The database is authoritative for literal matching completeness and publication. **Typo-only matches still depend on Meilisearch document coverage and its configured retrieval window.** Meilisearch documents a default retrieval ceiling of 1,000, controlled by `pagination.maxTotalHits`; this is separate from the removed application-wide 100-match cap. The active deployment's settings were not verified and were not changed. [Official search API reference](https://www.meilisearch.com/docs/reference/api/search/search-with-post), [index settings reference](https://www.meilisearch.com/docs/reference/api/settings/list-all-settings).

Live checks confirmed genre matching (`Animation`), description matching (`somalia`) and a typo match (`Mogadishp`). The original live endpoint returned no channel-name matches for `CBM Originals`; the local repair covers channel names through current database metadata.

## Verification

| Check | Result |
| --- | --- |
| Backend search/reindex/synchronization tests | **42 passed** in an isolated SQLite test database. Every index operation was mocked; no production DB/index was used. |
| Frontend automated tests | **25 passed**, including the updated six-item New Releases rule. |
| Browser scenarios for the existing popup | **19 passed**, zero uncaught browser exceptions. |
| TypeScript | Passed. |
| Lint/layout guard | Passed; nine existing warnings in ChannelSwiper, LanderCarousel and ProfileEditForm, no errors. |
| Production build | Passed; `/trends` and existing routes compiled. |
| Whitespace checks | Passed for the changed frontend/backend source. |

The regression set covers the actual missing-title failure, partial/stale index results, deleted/unpublished IDs, unchanged index relevance order, outages, mixed-field matching, category preservation, more than 100 database matches, more than 100 index-only matches, pagination boundaries, and compatibility with callers that do not paginate.

Browser checks exercised the actual patched Django view against isolated copies of the eight public records and a 137-match fixture. All eight real titles were findable there; the missing title appeared first. The same popup reached all 137 matches without duplicates or private records. Tests also covered scrolling, failed continuation/retry without automatic retry loops, old backend responses, query changes, keyboard navigation and correct detail links.

Verified viewport sizes: 360×800, 390×844, 768×1024, 1024×768, 1440×900, and 844×390 landscape. No page overflow was observed. Physical mobile keyboards and iOS/Safari were not tested.

Screenshots of the retained interface: [390px](screenshots/stage-4-390.png), [1440px](screenshots/stage-4-1440.png). Evidence: before live audit (local verification artifact), browser results (local verification artifact), backend test log (local verification artifact).

## Meilisearch inspection and remaining boundary

Existing indexed documents contain `id`, `title`, `genre`, `content_type` and `description`. Incremental content changes already queue index maintenance after database commit. Public search hydrates against approved database records rather than trusting stale index document payloads.

No explicit searchable/filterable/sortable settings configuration was found in the existing index-maintenance code. The Meilisearch host in the local backend configuration returned 404 for health, index listing and settings inspection. Public production search nevertheless reported working Meilisearch responses. The local configuration therefore cannot be assumed to identify the active production deployment.

No key was moved into frontend code. No live index was rebuilt, deleted, synchronized or reconfigured. A future maintenance operation should first identify the active deployment/index, compare approved database IDs with indexed IDs, and inspect its searchable/filterable/sortable fields and retrieval ceiling. It must use the correct production data source, never rebuild a live index from a local fixture database.

## Trends and ranking

Trends now has its own `/trends` route; navigation no longer labels the ordinary catalogue as Trends. The page shows a truthful unavailable state and links to existing browsing destinations. It does not substitute New Releases, Meilisearch relevance, manual flags or fabricated cards for engagement-based rankings.

The backend has an editable `is_trending` flag, but it is editorial, not a time-window engagement measure. Existing progress stores one latest row per viewer/title. Seeking, repeated viewing, episode changes and deletion overwrite or remove that snapshot. It cannot establish qualified views, accumulated watch time or recent engagement growth. Private dashboard analytics count current saved/progress records; they are not a public ranking service.

Platform, category, channel and channel-plus-category ranking therefore remain unsupported and disabled. No new analytics collection or aggregation was implemented under the search-fix approval.

### Documented ranking proposal — not implemented

Use verified playback sessions with deduplicated qualified viewers, actual played time excluding seek jumps, and completed sessions. Define qualification and minimum sample sizes from agreed product rules and actual traffic before enabling rankings.

For a specified window `w`, a provisional combined score is:

`R(w) = 0.50 × percentile(qualified unique viewers) + 0.30 × percentile(validated watch minutes) + 0.20 × completed-session rate`

These weights are an explicit proposal for product approval and calibration, not measured production values. Use a 90-day window for Top Ranked. Trending should use a separately labelled recent window, such as seven days, with recent engagement and growth against the previous seven days; publication date is not a substitute. Suppress samples too small to interpret reliably.

The smallest compatible next slice is server-side engagement records/aggregation plus a read-only, approved-content ranking response carrying its window and update time. Apply real channel associations and category filters to that response. Meilisearch could later sort generated numeric fields, but it must not originate or fabricate the engagement score. This requires separate approval before implementation.

The current content model has one channel foreign key. Multi-channel ranking/association needs a compatible backend association extension; no duplicate content uploads or model migration was introduced here.

## New Releases

The homepage now selects **up to six unique approved items**, ordered by `created_at` descending with ID as the tie-breaker, from its existing bounded category previews. There are no category or channel quotas. The live catalogue supplied six actual items, IDs 14 through 9; fewer items remain supported.

`created_at` records catalogue creation. There is no authoritative release-date or publication-date field, so the row is explicitly described as recently added to CBM TV. It does not claim a cinema release date or engagement ranking. The preview API orders by ID; exact global ordering for backdated/imported records outside those bounded previews would require an explicit server ordering capability. Editorial scheduling and dashboard controls were not changed.

## Hero inspection — unchanged

The homepage primarily uses the existing advert endpoint. Entries with `show_in_hero !== false` and valid artwork/media are sorted by `hero_order`, then ID. Image rotation uses existing `HeroSettings.image_duration_seconds`; video advances on completion. When no eligible advert exists, the first approved featured title is a fallback.

Existing React dashboard advert controls expose hero inclusion and order, and its hero settings page controls image duration. Django admin exposes `is_featured` and `is_trending` as editable content flags. No new scheduling, time-of-day rules, channel spotlights or featured-slot system was implemented. Those would need explicit data fields and dashboard work in a later stage.

## Files changed in this stage

Frontend paths relative to `cbmtv frontend`:

- `src/components/Searchbar.tsx`, `src/hooks/useSearch.ts`, `src/services/search.ts`: pagination in the existing popup, bounded request timeout, deduplication and continuation recovery.
- `src/lib/catalogue.ts`, `src/app/page.tsx`, `tests/catalogue-auth.test.mjs`: six recent additions and focused selection tests.
- `src/app/trends/page.tsx`, `src/components/TrendsPage.tsx`, `src/components/NavBar.tsx`, `src/app/globals.css`: truthful separate Trends destination.
- `docs/search-exhaustiveness-plan.md`, `docs/stage4-review.md`: approved repair plan and final findings.

Backend paths relative to `cbmtv-backend`:

- `content/views.py`: complete database matching supplement and backward-compatible search continuation.
- `content/test_search_exhaustiveness.py`: nine focused completeness/continuation regressions.
- `content/test_search_reindex.py`: existing hydration tests use a term absent from searchable metadata, keeping their isolation assertions meaningful now that channel names are searched. No tests were removed.

Stage 1–3 modifications and unrelated existing backend working-tree changes were preserved. The temporary expanded search UI was removed; its components, helpers, tests and CSS are not part of the final code.

## Release status

Backend search PR [#16](https://github.com/CBM-GROUP/cbmtv-backend/pull/16) has been merged. Frontend Stage 4 remains unmerged. Production rollout follows the existing backend deployment configuration; no manual deployment or live index maintenance was performed here. The popup also supports older API responses until continuation fields are available.
