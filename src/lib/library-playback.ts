import type { WatchProgress, WatchProgressInput } from "@/types";

export const SAVE_EVERY_SECONDS = 15;
export const COMPLETION_RATIO = 0.95;

export function progressPartKey(row: Pick<WatchProgress, "episode" | "miniseries">): string | null {
  if (row.episode != null) return `episode:${row.episode}`;
  if (row.miniseries != null) return `part:${row.miniseries}`;
  return null;
}

export function shouldSaveCheckpoint(position: number, lastSaved: number, duration: number, force = false) {
  if (!Number.isFinite(position) || position < 5) return false;
  if (Math.floor(position) === Math.floor(lastSaved)) return false;
  if (force) return true;
  return Math.abs(position - lastSaved) >= SAVE_EVERY_SECONDS ||
    (duration > 0 && position >= duration * COMPLETION_RATIO && lastSaved < duration * COMPLETION_RATIO);
}

export function checkpoint(content: number, position: number, duration: number, episode?: number | null, miniseries?: number | null): WatchProgressInput {
  return {
    content,
    episode: episode ?? null,
    miniseries: miniseries ?? null,
    position_seconds: Math.max(0, Math.floor(position)),
    duration_seconds: Math.max(0, Math.floor(duration)),
  };
}
