/** Only known content routes and numeric playback selectors can be resumed. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !/^\/programs\/[1-9]\d*(?:\?|$)/.test(value)) return "/";
  try {
    const url = new URL(value, "https://cbmtv.invalid");
    if (url.origin !== "https://cbmtv.invalid" || !/^\/programs\/[1-9]\d*$/.test(url.pathname)) return "/";
    const clean = new URLSearchParams();
    if (url.searchParams.get("play") === "1") clean.set("play", "1");
    for (const key of ["episode", "part"] as const) {
      const id = url.searchParams.get(key);
      if (id && /^[1-9]\d*$/.test(id)) { clean.set(key, id); break; }
    }
    return `${url.pathname}${clean.size ? `?${clean}` : ""}`;
  } catch { return "/"; }
}

export function playbackDestination(id: number, part?: { episode?: number; miniseries?: number }): string {
  const query = new URLSearchParams({ play: "1" });
  if (part?.episode) query.set("episode", String(part.episode));
  else if (part?.miniseries) query.set("part", String(part.miniseries));
  return safeReturnTo(`/programs/${id}?${query}`);
}

export function signInDestination(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
