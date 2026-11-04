import axios, { type AxiosRequestConfig } from 'axios';
import { publicApiClient, unauthorizedEvent } from './api';
import { progressTokenBelongsToUser } from '../lib/homepage-progress';

export class ViewerSessionChangedError extends Error {
  constructor() { super('The viewer session changed.'); }
}

/** Keep credentials and refresh tied to the requesting viewer across tab changes. */
export async function viewerRequest<T>(userId: number, config: AxiosRequestConfig) {
  const access = localStorage.getItem('access_token');
  const refresh = localStorage.getItem('refresh_token');
  if (!progressTokenBelongsToUser(access, userId)) throw new ViewerSessionChangedError();
  const send = async (token: string) => {
    if (!progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) throw new ViewerSessionChangedError();
    const response = await publicApiClient.request<T>({ ...config, headers: { ...config.headers, Authorization: `Bearer ${token}` } });
    if (!progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) throw new ViewerSessionChangedError();
    return response;
  };
  try { return await send(access); }
  catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
    const current = localStorage.getItem('access_token');
    if (!progressTokenBelongsToUser(current, userId)) throw new ViewerSessionChangedError();
    // Another request may already have refreshed this same account.
    if (current !== access) return send(current);
    if (!progressTokenBelongsToUser(refresh, userId) || localStorage.getItem('refresh_token') !== refresh) throw new ViewerSessionChangedError();
    const result = await publicApiClient.post<{ access: string }>('/api/accounts/token/refresh/', { refresh }, { signal: config.signal }).catch((cause: unknown) => {
      // A rejected refresh belongs only to the exact session that requested it.
      // Another tab may have logged in, or another request may have refreshed.
      if (localStorage.getItem('access_token') !== access || localStorage.getItem('refresh_token') !== refresh) throw new ViewerSessionChangedError();
      if (axios.isAxiosError(cause) && (cause.response?.status === 400 || cause.response?.status === 401)) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        document.dispatchEvent(unauthorizedEvent);
      }
      throw cause;
    });
    // Never replace credentials installed by a different tab/session meanwhile.
    if (localStorage.getItem('refresh_token') !== refresh || !progressTokenBelongsToUser(localStorage.getItem('access_token'), userId)) throw new ViewerSessionChangedError();
    if (!progressTokenBelongsToUser(result.data.access, userId)) throw new ViewerSessionChangedError();
    localStorage.setItem('access_token', result.data.access);
    return send(result.data.access);
  }
}
