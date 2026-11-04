import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { viewerRequest, ViewerSessionChangedError } from '@/services/viewer-api';
import type { Progress } from '@/services/homepage';
import { progressSample, progressTokenBelongsToUser } from '@/lib/homepage-progress';

export function usePlaybackProgress(userId: number | undefined, contentId: number) {
  const [loaded, setLoaded] = useState<{ userId?: number; contentId: number; progress: Progress | null } | null>(null);
  const [failure, setFailure] = useState<{ userId: number; contentId: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastWrite = useRef(0);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('access_token');
    if (!progressTokenBelongsToUser(token, userId)) {
      setLoaded({ userId, contentId, progress: null });
      return;
    }
    const controller = new AbortController();
    void viewerRequest<Progress>(userId, { url: `/api/library/progress/${contentId}/`, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted && progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) setLoaded({ userId, contentId, progress: data }); })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ViewerSessionChangedError || (axios.isAxiosError(cause) && cause.response?.status === 404)) setLoaded({ userId, contentId, progress: null });
        else setFailure({ userId, contentId });
      });
    return () => controller.abort();
  }, [userId, contentId, attempt]);

  const record = useCallback((position: number, duration: number, episode?: number, miniseries?: number, force = false) => {
    if (!userId) return;
    const sample = progressSample(position, duration);
    if (!sample || (!force && Date.now() - lastWrite.current < 15000)) return;
    lastWrite.current = Date.now();
    const token = localStorage.getItem('access_token');
    if (!progressTokenBelongsToUser(token, userId)) return;
    // Keep writes ordered, and never send a queued write under a different
    // account's token after a logout/login switch.
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (!token || localStorage.getItem('access_token') !== token) return;
      try {
        await viewerRequest(userId, { method: 'POST', url: '/api/library/progress/', data: { content: contentId, episode: episode ?? null, miniseries: miniseries ?? null, ...sample } });
      } catch (cause) {
        if (!axios.isCancel(cause)) lastWrite.current = 0;
      }
    });
  }, [userId, contentId]);
  const ready = !userId || (loaded?.userId === userId && loaded.contentId === contentId);
  const error = failure?.userId === userId && failure?.contentId === contentId;
  const retry = () => { setFailure(null); setAttempt((value) => value + 1); };
  return { ready, error, retry, progress: userId && ready ? loaded?.progress : null, record };
}
