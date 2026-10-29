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

/** Select from bounded candidates supplied by the public category endpoint. */
export function selectNewReleases(items: Program[]): Program[] {
  const ordered = newestEligible(items);
  const usedChannels = new Set<number>();
  return CATEGORIES.flatMap(({ types }) => {
    const candidates = ordered.filter((item) => types.includes(item.content_type));
    const chosen = candidates.find((item) => !usedChannels.has(item.channel)) ?? candidates[0];
    if (!chosen) return [];
    usedChannels.add(chosen.channel);
    return [chosen];
  });
}
