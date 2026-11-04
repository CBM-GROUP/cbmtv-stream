import apiClient, { publicApiClient } from './api';
import { viewerRequest } from './viewer-api';
import { searchContent, type SearchMode } from './search';
import type { Program } from '@/types';

export type DiscoveryList = { available?: boolean; stale?: boolean; items: Program[]; total?: number;
  personalized?: boolean; reason?: string; basis?: string };
export type DiscoverySource = 'similar' | 'personalized' | 'trending' | 'most_watched';

export async function getRanking(kind: 'most-watched' | 'trending', signal?: AbortSignal): Promise<DiscoveryList> {
  const { data } = await publicApiClient.get<DiscoveryList>(`/api/discovery/rankings/${kind}/`, { params: { limit: 12 }, signal });
  return data;
}

export async function getSimilar(id: number, signal?: AbortSignal): Promise<DiscoveryList> {
  const { data } = await publicApiClient.get<DiscoveryList>(`/api/discovery/similar/${id}/`, { params: { limit: 12 }, signal });
  return data;
}

export async function getRecommended(userId: number, signal?: AbortSignal): Promise<DiscoveryList> {
  const { data } = await viewerRequest<DiscoveryList>(userId, { url: '/api/discovery/recommended/', params: { limit: 12 }, signal });
  return data;
}

async function send(event: Record<string, unknown>): Promise<boolean> {
  try {
    const client = typeof localStorage !== 'undefined' && localStorage.getItem('access_token') ? apiClient : publicApiClient;
    const { data } = await client.post<{ accepted: boolean }>('/api/discovery/events/', { event_id: crypto.randomUUID(), ...event });
    return data.accepted;
  } catch { return false; } // Analytics never blocks browsing or playback.
}

const searches = new Map<string, { id: string; at: number; pending: Promise<string | null> }>();
const searchKey = (query: string, mode: SearchMode) => `${mode}:${query.trim().toLocaleLowerCase()}`;

export function submitSearchEvent(query: string, mode: SearchMode, receipt?: string | null): Promise<string | null> {
  const key = searchKey(query, mode);
  const prior = searches.get(key);
  if (prior && Date.now() - prior.at < 2000) return prior.pending;
  const id = crypto.randomUUID();
  const pending = (async () => {
    const proof = receipt ?? (await searchContent(query, 20, undefined, mode)).receipt;
    if (!proof) return null;
    return await send({ type: 'search_submitted', receipt: proof, event_id: id }) ? id : null;
  })().catch(() => null);
  searches.set(key, { id, at: Date.now(), pending });
  return pending;
}

export async function recordSearchSelection(query: string, mode: SearchMode, content: number, receipt?: string | null) {
  const key = searchKey(query, mode);
  const prior = searches.get(key);
  const searchId = prior && Date.now() - prior.at < 600000 ? await prior.pending : await submitSearchEvent(query, mode, receipt);
  if (searchId) await send({ type: 'search_selected', search_id: searchId, content, receipt });
}

export const recordDetailOpened = (content: number) => send({ type: 'detail_opened', content });
export const recordRecommendationSelection = (content: number, source: DiscoverySource) =>
  send({ type: 'recommendation_selected', content, source });
export const recordPlaybackEvent = (type: 'playback_started' | 'playback_progress' | 'playback_completed',
  sessionId: string, position: number, duration: number) =>
  Number.isFinite(position) && Number.isFinite(duration) && duration > 0 ?
    send({ type, session_id: sessionId, position_seconds: position, duration_seconds: duration }) : Promise.resolve(false);
