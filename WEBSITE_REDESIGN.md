# Website redesign review notes

The public site now has a compact, borderless header, one search dialog at every width, a shorter mobile hero, bounded category rails, a catalogue with Load more, and a dedicated sign-in page. Content cards and detail pages remain public; a playback request carries the selected content and episode through sign-in. The existing email/password and Google authentication services are reused.

## File-by-file changes

| File | Change |
| --- | --- |
| `src/app/page.tsx` | Builds the hero and ordered category rails from bounded API queries; keeps channels below the content rows. |
| `src/app/programs/page.tsx` | Provides the real See All destination with category selection. |
| `src/app/sign-in/page.tsx` | Adds the dedicated sign-in screen with a validated content return route. |
| `src/app/layout.tsx` | Adds the skip-link target. |
| `src/app/globals.css` | Sets shared header, hero, rail, and form spacing and viewport-aware sizing. |
| `src/components/NavBar.tsx` | Replaces the two-row, boxed header with a compact overlay and existing-route links. |
| `src/components/SearchSheet.tsx` | Replaces the placeholder with a working search dialog. |
| `src/components/Searchbar.tsx` | Reuses API search in the dialog with keyboard and async result states. |
| `src/components/HomeHero.tsx` | Preserves advert rotation, adds a featured-content fallback, readable actions, and stable mobile height. |
| `src/components/ContentRail.tsx` | Adds scrollable rails, matching skeletons, and retry/error handling. |
| `src/components/CatalogueBrowser.tsx` | Adds a paginated, category-filtered browse screen. |
| `src/components/ProgramCard.tsx` | Uses consistent artwork geometry and accessible detail links. |
| `src/components/ProgramDetail.tsx` | Shows public details before playback, gates movie/episode starts at sign-in, and retains existing episodic controls. |
| `src/components/LoginForm.tsx` | Reuses email/password and Google services; registration signs in and resumes the selected title. |
| `src/components/Footer.tsx` | Keeps real links and branding in a compact layout. |
| `src/components/SafeImage.tsx` | Allows the hero to serve its local artwork directly; the optimized image stayed blank at 1024 pixels in browser testing. |
| `src/components/ui/sheet.tsx` | Makes the close icon inherit the dialog's text colour. |
| `src/hooks/useHomeCatalogue.ts` | Shares bounded category and featured queries with React Query. |
| `src/services/content.ts` | Adds public paginated home and catalogue reads. |
| `src/lib/catalogue.ts` | Defines real backend categories, newest-first ordering, and deterministic channel-diverse release selection. |
| `src/lib/auth-return.ts` | Validates internal playback return destinations. |
| `tests/catalogue-auth.test.mjs` | Covers approved release selection, ties, channel diversity, and safe return paths. |

## Backend contract observed

- `Content.CONTENT_TYPES` contains `movie`, `series`, `documentary`, `animations`, `miniseries`, `original`, and `music`. There is no distinct TV Shows type. The site labels `original` as **Originals** and omits a separate TV Shows rail.
- Public list/detail/search queries use the backend's approved-only visibility. The site also filters list results to `status === "approved"` before rendering.
- `created_at` is the only timestamp on Content and is set when a record is created. The public list is ordered by `-id`, not by `created_at`; no publication/release date or server-side ordering parameter exists. Home rails request the first 12 rows per category and sort those candidates by `created_at DESC, id DESC`. New Releases selects one per populated category, preferring a channel not already represented. This is deterministic within the response, but an older ID with a newer timestamp outside those 12 rows would be missed. It also cannot distinguish the approval date from the creation date.
- To guarantee the requested release rule, the backend needs a publication timestamp set at approval, plus a public, approved-only feed ordered by `-published_at, -id`, with category filtering and enough candidates for channel diversity. A server-produced one-per-category New Releases feed would avoid extra requests and make the policy authoritative. This phase leaves the backend untouched.
- Public content detail currently includes direct `streaming_link` URLs. The website does not mount video before sign-in, but a determined unsigned client can read that URL from the public API. Enforcing authentication at the media boundary needs a backend playback endpoint or short-lived authorized URL and a delivery policy that rejects public direct access. The current UI gate alone is not media authorization.
- Hero adverts do not carry a Content foreign key. An advert link matching `/programs/<id>` gets Watch Now and More info actions; other valid HTTP(S) or internal links keep an Explore action. When no advert is eligible, the first featured approved Content record supplies the hero.

## Verification and remaining limits

`npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` passed on 27 October 2026. ESLint reports nine pre-existing warnings in unused legacy components and `ProfileEditForm`; no errors. The production build needed network access to fetch the existing Geist fonts. It also logged a refused local backend connection while prerendering the existing `/channels` page because Django was not running; the build completed.

Browser checks used a local fixture API rather than production content: exact 320×568, 360×720, 390×844, 768×1024, 1024×768, and 1280×800 viewports; no document overflow; one search control; category order; loaded artwork; populated/empty/error search states; Escape, arrow keys and Enter; anonymous detail browsing; Watch Now redirect; and fixture email sign-in returning to both selected movie and episode playback. Baseline screenshots were captured from an isolated archive of the original commit with the same fixture. Screenshots and the fixture/check scripts are in `../build-artifacts/website-redesign/`. Google Sign-In, real Django authorization, real media delivery, and live catalog data still need staging acceptance.

No player, transcoding, S3, or CloudFront configuration was changed. The player still uses direct media URLs; any buffering, format, or delivery latency needs measurements against actual media and a separate performance review. The site does not expose legal-page links because the repository has no legal routes.
