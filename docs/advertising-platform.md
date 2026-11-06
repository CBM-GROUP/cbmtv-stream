# Website advertising integration

Local Branch 6 work; no deployment or production activation. The backend's
`ADVERTISING_ENABLED` gate defaults false. A ready playback grant now includes
`advertising_enabled`; a false/missing value uses the ordinary player directly.

`AdvertisingVideo` wraps the existing HLS/progressive `TrackedVideo`. The wrapper
is keyed to viewer and server playback session rather than signed source URL.
The existing trailer state is preserved. Pre-roll runs only after an authorized
main-content grant, configured mid-rolls retain the last main playhead, and
post-roll finishes before the existing next-episode countdown starts. A bounded
in-memory map prevents repeated breaks across rerenders and renewals. Paid video
never uses organic progress/analytics callbacks. Switching accounts or selected
episodes gets a distinct authorized session.

`TrackedVideo` retains native HLS/hls.js, recovery, quality switching and browser
autoplay handling. Advertisement mode disables native seeking, supplies compact
touch controls, exposes actual playing/paused/buffering state, and fails open
after a five-second loading deadline. All content remains in the same fullscreen
container. Advertising has its own label, advertiser, countdown, approved CTA and
campaign-controlled skip button. No trailer ad insertion is implemented.

`SponsoredPlacement` is used for enabled advertising sections returned by the
homepage management API, and for channel/content context placements. It renders
optimized responsive artwork, internal promotions and curated sponsored title
cards using the existing ProgramCard. Publication is revalidated by the backend.
There are no hardcoded homepage advertising rows or new channel relationships.

The advertising service uses the viewer-scoped API helper. Public context sessions
are shared by sibling placements for ten minutes in memory, expire before their
15-minute decision receipts, and are never persisted as tracking cookies/device
identifiers. Account and context keys are distinct. Session and decision calls
have 1.2-second deadlines and fall back to ordinary content. Event delivery is
serialized by decision, idempotent on the server, and acknowledged before marking
milestones complete. Internal links use Next Link so queued click events survive
navigation. Images require one continuous second of visible loaded display;
video requires two continuous seconds of actual visible playback. Hidden tabs,
intersection loss, pauses and buffering reset qualification.

Backend contracts and operational instructions are in that repository's
`docs/advertising-platform.md`. Detailed local results and limitations are in the
workspace `BRANCH6_ADVERTISING_REVIEW.md`. Browser fixtures use generated media and
local APIs only; production AWS, physical mobile devices, Safari and real autoplay
policies remain staging checks. The website emits numeric-only local
`cbmtv:advertising-metric` decision/startup timing events without protected URLs.

Verify with `node --test tests/*.test.mjs`, TypeScript, layout lint, ESLint and a
production build. For this Windows worktree's existing linked dependencies use
`next build --webpack`; Node's system certificate store is required for the
existing Google Fonts build. Build browser fixtures with
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18041`, then run
`node tests/playback-media.browser.mjs` and `node tests/advertising.browser.mjs`
sequentially. They use loopback API 18041, Next 3014, Chrome CDP 9344, FFmpeg and
headless Chrome, and stop their own processes. Artifacts are under
`.next/playback-media-proof/` and `.next/advertising-proof/`.
