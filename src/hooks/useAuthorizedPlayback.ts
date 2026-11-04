'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { viewerRequest } from '@/services/viewer-api';

type Grant = { url: string; type: 'hls' | 'progressive'; with_credentials: boolean; expires_at: string; session_id?: string };

export function useAuthorizedPlayback(userId: number | undefined, contentId: number, episode: number | undefined, miniseries: number | undefined, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; grant?: Grant; message?: string }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const key = `${userId}:${contentId}:${episode ?? ''}:${miniseries ?? ''}:${enabled}`;
  useEffect(() => {
    if (!userId || !enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let processingPolls = 0;
    let sessionId: string | undefined;
    const authorize = async () => {
      try {
        const { data } = await viewerRequest<Grant>(userId, { method: 'POST', url: `/api/content/${contentId}/playback/`,
          data: { episode, miniseries, session_id: sessionId }, withCredentials: true, signal: controller.signal, timeout: 20000 });
        if (controller.signal.aborted) return;
        setResult({ key, grant: data });
        sessionId = data.session_id;
        // Cookies renew without changing the HLS URL or restarting the player.
        const delay = Date.parse(data.expires_at) - Date.now() - 60000;
        if (Number.isFinite(delay)) timer = setTimeout(() => void authorize(), Math.max(10000, delay));
      } catch (cause) {
        if (controller.signal.aborted) return;
        const state = axios.isAxiosError(cause) ? cause.response?.data?.state : undefined;
        const processing = ['uploaded', 'queued', 'processing'].includes(state);
        setResult({ key, message: processing ? 'This video is processing. Playback will become available when it is ready.' :
          axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session expired. Sign in to continue.' : 'Playback is unavailable. Please try again.' });
        if (processing && processingPolls++ < 12) timer = setTimeout(() => void authorize(), 5000);
      }
    };
    void authorize();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [key, userId, contentId, episode, miniseries, enabled, attempt]);
  return { grant: result.key === key && enabled ? result.grant : undefined, message: result.key === key ? result.message : undefined,
    retry: () => setAttempt(value => value + 1) };
}
