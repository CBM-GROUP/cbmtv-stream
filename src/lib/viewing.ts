import type { ContentType, Episode, MiniSeries, Season, WatchProgress } from "../types/index";

export type Part = { key: string; id: number; title: string; url: string; episode?: number; miniseries?: number; season?: number; number: number; duration?: string | null; thumbnail?: string | null };
export type PartSelector = { episode?: number; miniseries?: number };

export function mediaSource(value: string | null | undefined): { kind: "direct" | "youtube"; url: string; videoId?: string } | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const youtube = url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com") || url.hostname === "youtu.be";
    if (!youtube) return { kind: "direct", url: url.href };
    const videoId = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || (/^\/(?:embed|shorts)\//.test(url.pathname) ? url.pathname.split("/")[2] : "");
    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? { kind: "youtube", url: url.href, videoId } : null;
  } catch { return null; }
}

export function contentCategory(type: ContentType): string {
  return ({ original: "TV Shows", series: "TV Shows", miniseries: "TV Shows", movie: "Movies", documentary: "Documentaries", animations: "Animations", music: "Music Videos" })[type] || "Content";
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.floor(seconds), minutes = Math.floor(total / 60), remainder = total % 60;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatDuration(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(?:(\d+)\s+)?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1] || 0) * 24 + Number(match[2]), minutes = Number(match[3]), seconds = Number(match[4]);
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", !hours && !minutes && seconds ? `${seconds}s` : ""].filter(Boolean).join(" ");
}

export function orderedUnique<T extends { id: number }>(items: T[], number: (item: T) => number): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => number(a) - number(b) || a.id - b.id);
}

export const orderedSeasons = (items: Season[]) => orderedUnique(items, (item) => item.season_number);
export const orderedEpisodes = (items: Episode[]) => orderedUnique(items, (item) => item.episode_number);
export const orderedMiniParts = (items: MiniSeries[]) => orderedUnique(items, (item) => item.miniseries_no);

export function episodePart(episode: Episode): Part | null {
  const source = mediaSource(episode.streaming_link);
  return source ? { key: `episode:${episode.id}`, id: episode.id, title: episode.title, url: source.url, episode: episode.id, season: episode.season, number: episode.episode_number, duration: episode.duration, thumbnail: episode.thumbnail } : null;
}

export function miniPart(part: MiniSeries): Part | null {
  const source = mediaSource(part.streaming_link);
  return source ? { key: `part:${part.id}`, id: part.id, title: part.title, url: source.url, miniseries: part.id, number: part.miniseries_no, duration: part.duration, thumbnail: part.thumbnail } : null;
}

export function matchingProgress(progress: WatchProgress | undefined, part?: PartSelector | null): boolean {
  return Boolean(progress && (progress.episode ?? null) === (part?.episode ?? null) && (progress.miniseries ?? null) === (part?.miniseries ?? null));
}

export function resumePosition(progress: WatchProgress | undefined, duration?: number): number {
  if (!progress || progress.completed || !Number.isFinite(progress.position_seconds) || progress.position_seconds < 5) return 0;
  const limit = Number.isFinite(duration) && (duration ?? 0) > 0 ? duration : progress.duration_seconds;
  return limit && progress.position_seconds >= limit * .95 ? 0 : progress.position_seconds;
}

export function unfinishedProgress(items: WatchProgress[]): WatchProgress[] {
  const unique = new Map<number, WatchProgress>();
  for (const item of items) if (item.content?.status === "approved" && resumePosition(item) > 0) {
    const previous = unique.get(item.content.id);
    if (!previous || Date.parse(item.updated_at) > Date.parse(previous.updated_at)) unique.set(item.content.id, item);
  }
  return [...unique.values()].sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0));
}
