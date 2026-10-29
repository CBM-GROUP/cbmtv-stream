# Existing search: coverage audit and focused repair

30 October 2026. The original search popup, its appearance, keyboard navigation and existing catalogue page have been restored. The full-page search redesign and its filters were removed. Existing Stage 1–3 work was preserved.

## Verified live failure

The public catalogue returned eight approved titles. Searching each full title with `limit=100` found seven:

- `Winning Proposal`, `Girl from Mogadishu`, `The Chicken Hunt`, `Finding My Ball`, `Escape from School`: found through Meilisearch.
- `Dear Dija`, `Queen of Katwe`: found only through database fallback. This establishes findability, not full index coverage.
- **`The Bigger Dream` (content 10): not found.** Its full-title query returned content 12, 11 and 13 through Meilisearch, omitting 10.

The existing `search_view` calls `_database_search` only when the hydrated Meilisearch rows are empty. A partially populated/stale index can therefore return weaker matches and suppress a valid database match. The approved database record remains authoritative for visibility, but is not currently authoritative for completeness.

Other checks: genre `Animation` returned three titles; description word `somalia` found content 13; typo `Mogadishp` found content 13. Channel name `CBM Originals` returned no titles. Its name is absent from indexed documents and the database fallback does not search channel names.

The popup requests eight hits. The endpoint caps `limit` at 100, has no continuation parameter, and reports the number returned rather than the full number matching. Raising a client limit alone would not make it exhaustive.

Audit evidence: search-audit.json (local verification artifact). The Meilisearch host in local backend configuration returned 404 for health/index inspection; it cannot be assumed to describe the active production deployment. No index was reconfigured or rebuilt.

## Approved local repair

The user approved this local backend repair on 30 October 2026. It is implemented and verified; see [Stage 4 review](stage4-review.md). No deployment or live index maintenance was authorized or performed.

1. Keep the existing GET search endpoint, Meilisearch integration, response fields and approved-content checks. Make no schema, authentication, dashboard, media or ranking changes.
2. Prevent partial index responses from suppressing eligible database matches. Ensure an exact published title is discoverable even when absent from the index, preserve relevance for genuine index matches, deduplicate results and never hydrate unpublished/deleted records.
3. Cover the specified public search fields consistently: title, description, genre and associated channel name. Do not treat media URLs, credentials or private fields as searchable content.
4. Add backward-compatible continuation fields/parameters so the existing popup can fetch further matches. Retain its layout; append results within its current scrolling list. Do not replace an eight-result cutoff with a silent 100-result cutoff.
5. Add regressions for the actual missing-title case, partial/stale index responses, publication changes, duplicate hits, database-only operation, and more than 100 matching records across pages. Verify that existing callers without continuation parameters still work.
6. Audit index document coverage separately. If live synchronization/reindexing or index settings need repair, present that exact operation for approval. Do not rebuild the live index from a local database or expose its master key in the frontend.

Expected files: backend `content/views.py` and focused search tests; frontend `src/services/search.ts`, `src/hooks/useSearch.ts` and minimal loading logic in `src/components/Searchbar.tsx`. Any extra index-document changes will be identified before application.

Backend PR #16 is merged. The frontend stage remains unmerged; no live index writes were performed.
