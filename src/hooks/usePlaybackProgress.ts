import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { viewerRequest, ViewerSessionChangedError } from '@/services/viewer-api';
import type { Progress } from '@/services/homepage';
import { progressSample, progressTokenBelongsToUser } from '@/lib/homepage-progress';

type Sample = { position_seconds: number; duration_seconds: number; episode: number | null; miniseries: number | null; refresh: string | null };
type Writer = { identity: string; lastWrite: number | null; lastQueued: string | null; latest: Sample | null };

export function usePlaybackProgress(userId: number | undefined, contentId: number, selectedEpisode?: number, selectedMiniseries?: number) {
  const identity = `${userId ?? ''}:${contentId}:${selectedEpisode ?? ''}:${selectedMiniseries ?? ''}`;
  const [loaded, setLoaded] = useState<{ identity: string; progress: Progress | null } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef(Promise.resolve());
  // Each closure retains its own viewer/part samples during source cleanup.
  const writer = useMemo<Writer>(() => ({ identity, lastWrite: null, lastQueued: null, latest: null }), [identity]);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    if (!progressTokenBelongsToUser(token, userId)) {
      setLoaded({ identity, progress: null });
      return;
    }
    const controller = new AbortController();
    void viewerRequest<Progress>(userId, {
      url: `/api/library/progress/${contentId}/`, signal: controller.signal,
      params: { episode: selectedEpisode, miniseries: selectedMiniseries },
    }).then(({ data }) => {
      if (!controller.signal.aborted && localStorage.getItem('refresh_token') === refresh && progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) {
        setLoaded({ identity, progress: data });
        setFailure((current) => current === identity ? null : current);
      }
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      if (cause instanceof ViewerSessionChangedError || (axios.isAxiosError(cause) && cause.response?.status === 404)) setLoaded({ identity, progress: null });
      else setFailure(identity);
    });
    return () => controller.abort();
  }, [userId, contentId, selectedEpisode, selectedMiniseries, identity, attempt]);

  const enqueue = useCallback((sample: Sample) => {
    if (!userId) return;
    const key = `${writer.identity}:${sample.episode}:${sample.miniseries}:${sample.position_seconds}:${sample.duration_seconds}`;
    if (writer.lastQueued === key) return;
    writer.lastQueued = key;
    writer.lastWrite = Date.now();
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (localStorage.getItem('refresh_token') !== sample.refresh || !progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) return;
      try {
        await viewerRequest(userId, { method: 'POST', url: '/api/library/progress/', data: {
          content: contentId, episode: sample.episode, miniseries: sample.miniseries,
          position_seconds: sample.position_seconds, duration_seconds: sample.duration_seconds,
        } });
      } catch (cause) {
        if (!axios.isCancel(cause) && writer.lastQueued === key) { writer.lastWrite = null; writer.lastQueued = null; }
      }
    });
  }, [userId, contentId, writer]);

  const record = useCallback((position: number, duration: number, episode = selectedEpisode, miniseries = selectedMiniseries, force = false) => {
    if (!userId) return;
    const value = progressSample(position, duration);
    if (!value || !progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) return;
    const sample: Sample = { ...value, episode: episode ?? null, miniseries: miniseries ?? null, refresh: localStorage.getItem('refresh_token') };
    writer.latest = sample;
    if (!force && writer.lastWrite !== null && Date.now() - writer.lastWrite < 15000) return;
    enqueue(sample);
  }, [userId, selectedEpisode, selectedMiniseries, writer, enqueue]);

  useEffect(() => {
    // Best effort on pagehide: Axios requests are not guaranteed during unload.
    const flush = () => { if (writer.latest) enqueue(writer.latest); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
      flush();
    };
  }, [writer, enqueue]);

  const ready = !userId || loaded?.identity === identity;
  const error = failure === identity;
  const retry = () => { setFailure(null); setAttempt((value) => value + 1); };
  return { ready, error, retry, progress: userId && ready ? loaded?.progress : null, record };
}
