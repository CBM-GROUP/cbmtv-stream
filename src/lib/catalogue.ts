import type { ContentType, Program } from "../types/index";

// There is no separate TV Shows type. Originals keep their own name.
export const CATEGORIES: { type: ContentType; title: string }[] = [
  { type: "movie", title: "Movies" },
  { type: "series", title: "Series" },
  { type: "documentary", title: "Documentaries" },
  { type: "animations", title: "Animations" },
  { type: "miniseries", title: "Miniseries" },
  { type: "original", title: "Originals" },
  { type: "music", title: "Music Videos" },
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
  return CATEGORIES.flatMap(({ type }) => {
    const candidates = ordered.filter((item) => item.content_type === type);
    const chosen = candidates.find((item) => !usedChannels.has(item.channel)) ?? candidates[0];
    if (!chosen) return [];
    usedChannels.add(chosen.channel);
    return [chosen];
  });
}
