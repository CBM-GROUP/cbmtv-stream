export type PlaybackMetric = "startup" | "rebuffer" | "error" | "quality";

/** Local measurement hook; never includes sources, tokens or viewer identity. */
export function playbackMetric(name: PlaybackMetric, values: {
  duration_ms?: number; code?: number; attempt?: number; level?: number;
  height?: number; bitrate?: number; automatic?: number;
}) {
  if (typeof window === "undefined") return;
  const detail: Record<string, string | number> = { name };
  for (const key of ["duration_ms", "code", "attempt", "level", "height", "bitrate", "automatic"] as const) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value)) detail[key] = Math.round(value);
  }
  window.dispatchEvent(new CustomEvent("cbmtv:playback-metric", { detail }));
}
