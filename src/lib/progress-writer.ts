import type { PartSelector } from "./viewing";
import type { ProgressPayload } from "../types/index";

export function progressPayload(content: number, part: PartSelector | null, position: number, duration: number, ended = false): ProgressPayload | null {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0 || position > duration + 1) return null;
  const finished = ended && position >= duration - .5;
  if (position < 5 && !finished) return null;
  return { content, episode: part?.episode ?? null, miniseries: part?.miniseries ?? null, position_seconds: finished ? Math.ceil(duration) : Math.floor(position), duration_seconds: Math.ceil(duration) };
}

/** One ordered write at a time; a failed request requires explicit recovery. */
export function createProgressWriter(send: (payload: ProgressPayload) => Promise<void>, failed: () => void, now = Date.now) {
  let latest: ProgressPayload | null = null, queued: ProgressPayload | null = null;
  let busy = false, blocked = false, disposed = false, urgent = false, lastSent = -Infinity;
  let acknowledged = "", inFlight = "";
  const drain = async () => {
    if (busy || blocked || !queued) return;
    const payload = queued; queued = null; urgent = false; busy = true; lastSent = now(); inFlight = JSON.stringify(payload);
    try { await send(payload); acknowledged = inFlight; } catch { blocked = true; failed(); }
    finally { busy = false; if (queued && urgent && !blocked) void drain(); }
  };
  return {
    sample(payload: ProgressPayload, force = false) { if (disposed) return; latest = payload; const key = JSON.stringify(payload); if ((!busy && key === acknowledged) || (busy && key === inFlight)) { queued = null; return; } queued = payload; urgent ||= force; if (force || now() - lastSent >= 15000) void drain(); },
    retry() { blocked = false; queued = latest; urgent = true; void drain(); },
    flush() { if (latest && (busy ? JSON.stringify(latest) !== inFlight : JSON.stringify(latest) !== acknowledged)) { queued = latest; urgent = true; void drain(); } },
    snapshot() { return latest; },
    isBusy() { return busy; },
    dispose() { disposed = true; if (!urgent) queued = null; },
  };
}
