import type { ContentType, Program } from "../types/index";

// The API calls TV Shows "original" and keeps miniseries as a separate type.
export const CATEGORIES: { type: ContentType; title: string; types: ContentType[] }[] = [
  { type: "original", title: "TV Shows", types: ["original"] },
  { type: "movie", title: "Movies", types: ["movie"] },
  { type: "series", title: "Series", types: ["series", "miniseries"] },
  { type: "animations", title: "Animations", types: ["animations"] },
  { type: "documentary", title: "Documentaries", types: ["documentary"] },
];

export const BROWSE_CATEGORIES = [...CATEGORIES, { type: "music" as ContentType, title: "Music Videos", types: ["music" as ContentType] }];

// Home groups all episodic formats under TV Shows; browse filters stay intact.
export const HOME_CATEGORIES: { type: ContentType; title: string; types: ContentType[]; href: string }[] = [
  { type: "movie", title: "Movies", types: ["movie"], href: "/programs?category=movie" },
  { type: "original", title: "TV Shows", types: ["original", "series", "miniseries"], href: "/programs" },
  { type: "documentary", title: "Documentaries", types: ["documentary"], href: "/programs?category=documentary" },
  { type: "animations", title: "Animations", types: ["animations"], href: "/programs?category=animations" },
];

export function newestEligible(items: Program[]): Program[] {
  const unique = new Map<number, Program>();
  for (const item of items) {
    if (item.status === "approved" && !unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()].sort((a, b) =>
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || b.id - a.id,
  );
}

/** Recent catalogue additions, not theatrical releases or popularity rankings.
 * created_at is the only available date; use ID as the deterministic tie-break.
 * Candidates come from the homepage's bounded public category previews.
 */
export function selectNewReleases(items: Program[]): Program[] {
  return newestEligible(items).slice(0, 6);
}

/** Membership comes from /channels/{id}/contents/, including any shared rows. */
export function buildChannelCatalogue(items: Program[]) {
  const published = newestEligible(items);
  const sections = ["original", "movie", "documentary", "animations"].flatMap((type) => {
    const category = HOME_CATEGORIES.find((item) => item.type === type);
    if (!category) return [];
    const titles = published.filter((item) => category.types.includes(item.content_type));
    return titles.length ? [{ type, title: category.title, items: titles }] : [];
  });
  const primaryTypes = HOME_CATEGORIES.flatMap((category) => category.types);
  return {
    published,
    featured: published.filter((item) => item.is_featured === true),
    sections,
    recent: published.slice(0, 12),
    // Preserve existing classifications outside the four primary categories.
    other: published.filter((item) => !primaryTypes.includes(item.content_type)),
  };
}
