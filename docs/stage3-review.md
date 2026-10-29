# CBM TV Stage 3 — local implementation review

Date: 29 October 2026. Frontend: `cbmtv frontend`. Review URL: http://127.0.0.1:3000. The ignored local environment still points to https://apicbmtv.cbmgroupco.com. No production data was written during verification.

## 1. Original problems

- Main content started before its optional trailer. Selecting another source remounted the native player, and there was no bounded recovery from a stalled load.
- The detail page repeated its synopsis, displayed unavailable metadata, used large gaps, and fetched the entire catalogue for related titles.
- Only the `series` category fetched seasons. All season episode lists were fetched eagerly; episode/part query links were not resolved into playback.
- The frontend did not use the existing saved-title and progress APIs. `/saved` and `/continue-watching` redirected to the catalogue.
- Standard fullscreen constrained the canvas to 16:9, wasting space for portrait videos. Cinema Mode was already in a compact options menu and did not need replacement.
- Live media has separate packaging, codec and delivery problems; these are described below.

## 2. Functionality preserved

Next.js App Router, React Query, axios authentication/refresh handling, native video controls, the YouTube iframe API, existing public routes, approved-content rules, category values and channel IDs remain in use. Public playback remains available to guests where the existing public API permits it. Header navigation, homepage hero, channel carousel and Stage 2 channel pages are preserved. No player library or dependency was added.

## 3. Stage 3 files

Paths below are relative to the frontend repository. Earlier Stage 1/2 changes remain in the working tree; this list identifies Stage 3 work.

| Area | Files |
| --- | --- |
| Detail route and states | `src/app/programs/[id]/page.tsx`, `loading.tsx`, `error.tsx` |
| Detail/player/episodes | `src/components/ProgramDetail.tsx`, `TrackedVideo.tsx`, `TrackedYouTube.tsx`, `PlayerOptions.tsx`, `SeasonsAccordion.tsx` |
| Library UI | `src/components/MyListButton.tsx`, `ContinueWatchingRail.tsx`, `LibraryPage.tsx`; `src/app/saved/page.tsx`, `src/app/continue-watching/page.tsx` |
| Shared layout and navigation | `src/app/globals.css`, `src/app/page.tsx`, `src/components/NavBar.tsx` |
| Library requests and state | `src/services/library.ts`, `src/hooks/useLibrary.ts`, `src/lib/progress-writer.ts` |
| Existing API helpers and contracts | `src/services/content.ts`, `src/services/series.ts`, `src/lib/api-routes.ts`, `src/lib/fetchAllPages.ts`, `src/types/index.ts` |
| Playback and presentation helpers | `src/lib/playback-flow.ts`, `src/lib/viewing.ts` |
| Focused automated tests | `tests/playback-flow.test.mjs`, `tests/viewing-progress.test.mjs` |
| Review documentation | `docs/stage3-review.md` |

Browser scripts, local fixture API, generated test media, screenshots, raw measurements and logs are in `build-artifacts/stage3-viewing` (local verification artifact). Test fixtures are outside application source and are never imported into production. `next-env.d.ts` was restored to its pre-task development-route import after Next regenerated it during the build.

## 4. Detail pages

Desktop uses a balanced player/information layout from 1024px. Mobile shows the player, a compact intact poster, title and viewing actions before the synopsis. One expandable synopsis replaces the duplicate blocks. Category, genre, country, duration, director and writer display only when supplied. The assigned channel links to its existing detail page. Sharing uses native share where available, with clipboard fallback and failure feedback.

The server validates numeric content IDs and approved status. Missing content and network failures take different paths; an API outage displays a retry state. Playback query selectors are validated and checked against the current title before an episode can play.

## 5. Player layout and recovery

The player keeps a stable responsive canvas and uses `object-fit: contain`; portrait and widescreen sources retain their original ratio. Fullscreen fills the screen in both standard and Cinema modes. Native play/pause, seek, volume, keyboard support and native fullscreen remain available.

Preparing, buffering, blocked autoplay, ready, interrupted and failed states have explicit feedback. Loading/buffering reaches a recovery action after 15 seconds rather than spinning indefinitely. Failed sources reload only on an explicit retry. A stalled source retains its current position. Browser media events and source/session guards prevent old events from restarting a new source. Native video stays mounted across trailer/main and Cinema changes; real unmount releases its media source. React development effect replay does not clear the retained video or issue repeated automatic play attempts.

A browser can silently decode only the audio in an otherwise valid video file. The player now detects missing video dimensions when playback begins, pauses that source and reports a decode failure. An incompatible trailer can fall through once to the main video. This prevents audio-only playback from being presented or recorded as successful video viewing.

## 6. Cinema Mode

The existing three-dot menu and separate fullscreen button are retained. Controls still hide while playing and reappear with pointer, touch, keyboard or focus interaction. The menu remains inside the fullscreen element. A compact Skip trailer item is available there during a trailer; a normal-size action below the player provides the same action outside fullscreen. No large floating Cinema or Skip overlay was introduced.

## 7. Trailer and resume flow

Fresh viewing attempts a valid configured trailer first, then the selected main video once. Identical trailer/main URLs do not create an automatic replay loop. Missing trailers start main content directly. Trailer completion, failure and skip use an idempotent transition; late trailer events cannot restart the movie.

Unfinished saved progress selects the correct episode/part and skips the automatic trailer. An explicit episode/part selector also skips it. A manually requested preview returns to the main viewing position. Repeated Watch clicks resume the active source rather than recreating it. Selecting a different episode starts a distinct session even if editorial data shares the same media URL. Replaying or choosing another episode cancels pending next-episode work.

Autoplay is attempted once per source/session. A browser rejection produces a clear Play action. Trailers are labelled as trailers, not advertisements; the separate existing homepage advertising integration is unchanged. The current API does not expose a separate automatic-trailer eligibility flag.

## 8. Playback performance findings

Environment: Windows host, headless Chrome 156.0.8078.48, 1440×900, unthrottled host internet, browser HTTP cache disabled for timing runs. The browser used explicit autoplay permission for comparable measurements. CloudFront cache state and internet throughput were not controlled. These are individual observations, not a benchmark or a claim of lower network buffering.

| Observation | Result |
| --- | --- |
| Original Finding My Ball main video | First frame 4.151 seconds after its play request; three normal MP4 range requests, including a tail metadata request. |
| Intermediate revised player, same main asset after explicit trailer skip | First frame 2.011 seconds after the source switch, with the same native element. This single faster run does not establish a network performance improvement. |
| Original Winning Proposal main | No first frame within the 25-second observation deadline. Selecting its trailer created a second video mount. |
| Final Winning Proposal configured trailer | Still exceeded the 25-second observation deadline. The UI provides bounded recovery; the trailer-to-movie timing could not be measured because trailer metadata was unavailable. |
| Final live Finding My Ball | Its incompatible trailer fell through to main without remounting. The main frame arrived 29.270 seconds after its first play request in this run; the harness also explicitly clicked Watch now again 5.420 seconds into that wait. Total time from the initial trailer play request to a main frame was 48.156 seconds. This much slower observation demonstrates that buffering is not resolved by the frontend changes. |
| Native source lifecycle | One native element through a source transition; Cinema does not reload it. Progress/UI updates do not initialize another player. |

The public media URLs are CloudFront MP4s, with HTTP range support. No HLS/DASH manifest or selectable rendition list was supplied. `Finding My Ball` is about 213 MiB and stores its MP4 `moov` metadata at the end; its approximately 27 MiB trailer does too. `Winning Proposal` is about 415 MiB and uses fragmented MP4 with early metadata, yet still stalled. Its trailer is about 49 MiB. `The Bigger Dream` has a roughly 131 MiB trailer. Asset naming alone is not evidence of codec compatibility.

`ffprobe` identified the live Finding My Ball trailer as 1920×1080 HEVC video plus AAC audio, duration 86.743544 seconds. In the headless browser its audio could play while no picture decoded. The new frontend guard handles that failure, but cannot supply a compatible video rendition. The deeper probe of the slow Winning Proposal asset was stopped rather than allowing an unbounded media read; its exact encoding failure remains unverified.

Evidence: before measurements (local verification artifact), intermediate measurements (local verification artifact), final measurements (local verification artifact), range/packaging probe (local verification artifact).

## 9. Seasons and episodes

Available seasons are discovered for TV, documentary and animation categories without changing the category. Episodes load on demand for a selected season, with numerical ordering, deduplication, artwork, duration, selected/playing state and unavailable-source controls. Miniseries retain their existing numbered parts. Empty season/part sections are hidden.

Episode links are validated against the title's own seasons and episode list. Next Episode skips unavailable entries, can load the next season, and stops when there is no valid successor or a request fails. The existing 30-second next-episode choice remains cancellable. Selecting the active episode resumes it rather than leaving it paused. Episode descriptions are not fabricated: the current episode serializer has no description field; supplied season descriptions are displayed.

## 10. Continue Watching and My List

Existing authenticated endpoints are used:

- `/api/library/progress/` and `/api/library/progress/{content_id}/`
- `/api/library/saved/`, `/api/library/saved/ids/`, `/api/library/saved/{content_id}/`

Eligible main-video progress starts saving after five seconds and saves periodically at 15-second intervals, plus pause, seek, completion and page lifecycle flushes. Writes are serialized, duplicate payloads are suppressed, and a failed write waits for manual recovery. Duration comes from the player; integer rounding avoids crossing the backend completion threshold prematurely. The backend's existing 95% completion rule is preserved. Page-exit delivery remains best effort under browser/network restrictions.

The homepage rail appears only for signed-in viewers with approved, unfinished content. Resume links include the existing numeric episode/part selectors. Removing a title uses the existing delete API and hides an empty homepage rail. My List provides saved/unsaved, loading and error feedback, and an immediate click lock. Library routes now display real account data and are discoverable in the Profile menu.

Progress and list caches are scoped by user ID. Playback waits for initial saved progress; if history cannot load, the viewer can retry or explicitly play without saving. A different account cannot silently inherit writes from the previous playback owner. Progress is not fabricated or stored in local storage. Cross-device state uses the existing server API, subject to its limitations below.

## 11. Responsive screenshots and visual checks

Live content screenshots show the real Finding My Ball metadata/artwork and the browser's explicit Play action when unmuted autoplay is blocked:

- [390px live page](screenshots/stage-3-390.png)
- [1440px live page](screenshots/stage-3-1440.png)

Isolated test videos demonstrate native picture sizing and desktop/mobile layout:

- 390px playback layout (local verification artifact)
- 1440px playback layout (local verification artifact)

Verified at 360×800, 390×844, 768×1024, 1024×768, 1440×900, and 844×390 landscape. No horizontal page overflow was observed. The same live pass checked homepage, Channel Box and a populated channel at every size, then search opening and Profile sign-in navigation. Source artwork and player bounds remain stable when media metadata arrives. A reserved playback-status slot removes the previously measured 52px content movement. Native controls and feedback can still change internally as a browser learns that a media codec is unsupported; these are not evidence of an encoded asset being repaired.

## 12. Verification results

| Check | Result |
| --- | --- |
| `npm test` | 24 passed, zero failed. |
| `npm run lint` | Exit 0; layout guard passed; zero errors, nine pre-existing warnings in ChannelSwiper, LanderCarousel and ProfileEditForm. |
| `tsc --noEmit` | Exit 0, including after restoring the user's generated route import. |
| `next build` | Exit 0; all public routes compiled and static pages generated. |
| Browser scenarios against isolated local API | 31 passed, zero uncaught browser exceptions. |
| Production browser checks using the live API | 27 passed, zero console errors or uncaught exceptions; all observed live API calls were GET. |
| `git diff --check` | Passed. |

The browser suite covers native source identity, trailer completion/failure, manual preview return, blocked autoplay without retry loops, timeout/error recovery, HEVC picture failure, seek/volume/pause, fullscreen, Cinema, portrait/widescreen media, category retention, next-season selection, unavailable and cross-title episode guards, resume/completion, saved-title click protection, failed progress writes, removal, unavailable-history opt-out and cleanup on navigation.

Logs: build (local verification artifact), unit tests (local verification artifact), lint (local verification artifact). Browser results: isolated scenarios (local verification artifact), live layouts/navigation (local verification artifact). PowerShell may format npm/Node stderr notices as `NativeCommandError` records in captured logs; the actual command exit codes and verification results above were checked separately.

Build warnings concern the existing baseline-browser-mapping data and Node dependency deprecations. The local preview uses the Windows system CA store; TLS verification was not disabled. Test media/API ran only on local ports 8003/3010; the final port-3000 preview uses the live API.

## 13. Backend and infrastructure gaps — proposals only

| Missing capability | Smallest compatible follow-up |
| --- | --- |
| Independent progress history for every episode | Preserve the current last-watched content entry, and add episode/part-specific uniqueness and a compatible history response. Currently the backend has one row per user/content, holding only its last episode/part. The frontend preserves that supported resume but cannot retain every episode's history. |
| Creating documentary/animated seasons | Permit the existing season/episode serializers to accept those primary categories while retaining category values. An optional explicit episodic-format field would also distinguish unpublished/empty series from films. Current writes restrict season parents to `series`, although reads can return other categories. |
| Multiple assigned channels | Add a compatible channel association collection while retaining the existing scalar field during transition. Current content has a single channel foreign key. No duplicate uploads or frontend data-model replacement were introduced. |
| Episode descriptions | Add an optional description field to the existing episode model/serializer. |
| Release year, age rating, languages, subtitle tracks, additional tags | Supply optional authoritative metadata fields. Until supplied, these are hidden. `created_at` is not treated as a film's release year. |
| Quality selection/adaptive bitrate | Provide compatible H.264/AAC renditions and/or an HLS/DASH manifest plus authoritative rendition metadata before adding a selector/player adapter. A single MP4 cannot provide honest quality choices. |
| Broad codec compatibility and startup | Produce a compatible H.264/AAC rendition, move metadata to the front of nonfragmented MP4s where appropriate, validate fragmented-media indexes/encoding, right-size promotional clips, and measure CDN range delivery. Frontend retry cannot repair those files. |
| Secure delivery/monitoring | Assess signed short-lived playback URLs if access policy requires them, and add an approved playback-error telemetry destination. Existing public static CDN URLs and console/local traces do not establish a protected media or monitoring service. |

No backend, media-processing or CDN changes were implemented.

## 14. Unverified scenarios and practical limits

The live catalogue had eight approved titles: movies, standalone animations, and a miniseries with a direct stream but no published parts. Live season, episode and miniseries-part APIs returned no records. Real TV episodes, documentary film/series, animated series and multipart transitions therefore remain unverified against production data; equivalent frontend paths passed isolated fixtures without changing primary categories.

No signed-in live credentials were available. Library writes, resume and removal were verified against the existing contracts in an isolated API, not by modifying a real account. Real cross-device synchronization, complete per-episode history, advertising eligibility beyond the existing integration, paid/access-restricted playback, native iOS/Safari fullscreen and physical touch-device playback remain unverified. Portrait/landscape checks used browser emulation, not physical hardware.

No live YouTube-linked content was available, so real YouTube autoplay, resume and error recovery remain unverified. The existing provider integration was retained and extended using its documented time/state/error APIs: [YouTube iframe API reference](https://developers.google.com/youtube/iframe_api_reference). The native MP4 paths were exercised in the browser tests.

Live trailer-to-movie performance remains asset- and network-dependent. Successful fixture transitions and an occasional fast CDN run are not proof that storage, encoding or network buffering has been solved.

## 15. Local review status

Frontend changes are submitted for review and remain unmerged. This frontend stage has not been merged. The administrative dashboard, backend code and Live TV were not modified. The final production preview is available at http://127.0.0.1:3000 for local review against the live API.
