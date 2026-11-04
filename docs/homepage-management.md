# Backend-managed homepage

This separately reviewable website diff is based on
`65b2094da85378fe0e05a6ae0112e8f1d352783c` (`origin/main`, including field search).
The original website checkout and its unrelated uncommitted changes were preserved.

`GET /api/homepage/` supplies stable section IDs, enabled flags, source labels and
ordered items. `HomeSections` renders that order and hides empty/disabled rails.
The homepage no longer uses client-selected editorial content or category quotas.
Existing browse/search/navigation routes and the compact mobile search stay in use.

Hero uses existing title images and links into existing detail/playback metadata.
It never consumes advert placements. An empty selection has a Browse content
fallback; missing images retain existing SafeImage behavior. Mobile hero stays
compact, with lazy rail images and reserved aspect ratios. Featured channels use
the existing linked channel cards with 16:9 artwork, snap/touch scrolling and a
scroll control. Category rails use backend taxonomy and support episodic titles.

Homepage queries are keyed by viewer ID, have no retained inactive cache, and
refresh every minute. Anonymous requests use the public API client. Personalized
rails require authentication and disappear immediately when authentication is lost.
HTTP responses are private/no-store on the backend; no response is shared publicly.

Continue Watching links carry numeric episode/part selectors. The existing native
video/YouTube components accept a matching saved start position and progress
callbacks; guests retain playback access and never write progress. Progress writes
are ordered and bind to the token subject owning the player. A token switch in
another tab cannot send the old player's activity into the new account. Completed
episodes with later playable parts resume those parts using the backend projection.

Account-bound requests use the existing refresh endpoint when access expires,
checking session ownership before replacing credentials or retrying. Homepage
personalization uses these checks too and falls back to public data on account mismatch.

This retains one stored progress row per title. Episode history, whole-series
completion, multi-device reconciliation and a full playback-engine rebuild remain
Branch 4 dependencies. Real streaming codec/CDN and device behavior require staging
checks; local fixtures exercise progress callbacks and resume links.

Verification: 21 Node tests, full typecheck, layout lint, ESLint and production build
passed. Nine lint warnings remain in unrelated pre-existing components. ESLint now
resolves plugins relative to its Next config package for pnpm compatibility;
dependencies/lockfiles are unchanged. Build used system TLS certificates for Google
Fonts, without disabling certificate checks.

The backend's `scripts/homepage-browser.mjs` drives both production Next apps
against a disposable in-memory API. Screenshots/measurements cover 320, 390, 768 and
1440px widths, compact hero/search, 16:9 channel artwork, scrolling, public/private
sections, viewer changes, API errors/retry and empty states. Fixture commands,
full contracts, migration handling and rollout sequence are documented in the
backend's `docs/homepage-management.md`.

Release backend first, then dashboard configuration, then this website. No merge or deployment is included.

Final review: feature-branch Vercel deployments are explicitly disabled in
`vercel.json`. PR CI runs the relevant tests, lint, typecheck and production build.
No PR is authorized for merge or deployment yet.

Terminal refresh 400/401 clears credentials and notifies AuthContext only for
the exact requesting session. A switched or concurrently refreshed session is
preserved; network/5xx failures retain credentials for retry.
