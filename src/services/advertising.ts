import { publicApiClient } from './api';
import { viewerRequest } from './viewer-api';

export type AdContext = { context: 'homepage' | 'channel' | 'content' | 'playback'; content?: number; channel?: number; playback_session?: string };
export type AdSession = { enabled: boolean; session: string | null; placements: { code: string; breakpoints: number[] }[] };
export type Advertisement = {
  decision_id: string; kind: 'image' | 'video'; name: string; advertiser: string; url: string;
  mobile_url?: string; width?: number; height?: number; duration_seconds?: number;
  destination_url: string; cta: string; skippable_after: number | null;
  source_type?: 'hls' | 'progressive'; with_credentials?: boolean; expires_at: string;
  promoted_content?: number | null; promoted_channel?: number | null;
  sponsored_items?: { id: number; title: string; thumbnail: string | null }[];
};
export type AdEvent = 'impression' | 'video_start' | 'first_quartile' | 'midpoint' | 'third_quartile' | 'complete' | 'click' | 'skip' | 'failure';

async function post<T>(path: string, data: unknown, userId?: number, signal?: AbortSignal, timeout = 1200): Promise<T> {
  const config = { url: `/api/advertising/${path}/`, method: 'POST', data, signal, timeout, withCredentials: true };
  return (await (userId ? viewerRequest<T>(userId, config) : publicApiClient.request<T>(config))).data;
}

const pageSessions = new Map<string, { expires: number; promise: Promise<AdSession> }>();
export function openAdSession(context: AdContext, userId?: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const key = `${userId ?? 'anonymous'}:${context.context}:${context.content ?? ''}:${context.channel ?? ''}:${context.playback_session ?? ''}`;
  const existing = pageSessions.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  // One short-lived, in-memory context session is shared by configured page
  // placements. An individual component cleanup must not cancel its sibling.
  const promise = post<AdSession>('session', context, userId).catch(cause => { pageSessions.delete(key); throw cause; });
  pageSessions.set(key, { expires: Date.now() + 10 * 60 * 1000, promise });
  if (pageSessions.size > 40) pageSessions.delete(pageSessions.keys().next().value as string);
  return promise;
}

export async function decideAd(session: AdSession, placement: string, breakKey: string, userId?: number, signal?: AbortSignal) {
  if (!session.enabled || !session.session || !session.placements.some(p => p.code === placement)) return null;
  const started = performance.now();
  try {
    const data = await post<{ ad: Advertisement | null }>('decision', { session: session.session, placement, break_key: breakKey, request_id: crypto.randomUUID() }, userId, signal);
    return data.ad;
  } finally {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cbmtv:advertising-metric', { detail: { kind: 'decision', duration_ms: performance.now() - started } }));
  }
}

// Serializing per decision preserves video milestone order despite network jitter.
// The server's (decision, kind) key also makes a retry safe.
const queues = new Map<string, Promise<boolean>>();
export function recordAdEvent(session: AdSession, ad: Advertisement, kind: AdEvent, position = 0, userId?: number) {
  if (!session.session) return Promise.resolve(false);
  const key = ad.decision_id;
  const task = (queues.get(key) ?? Promise.resolve()).then(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await post('events', { session: session.session, decision_id: key, kind, position_seconds: Math.max(0, Math.min(300, Math.ceil(position))) }, userId, undefined, 3000);
        return true;
      } catch { if (attempt === 1) return false; }
    }
    return false;
  });
  queues.set(key, task);
  void task.finally(() => { if (queues.get(key) === task) queues.delete(key); });
  return task;
}

export function approvedAdHref(ad: Advertisement): string | undefined {
  // Defense in depth; the API supplies the reviewed destination verbatim.
  if (!ad.destination_url) return undefined;
  try { const url = new URL(ad.destination_url); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
