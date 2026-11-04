import axios, { type InternalAxiosRequestConfig } from "axios";
import { jwtDecode } from "jwt-decode";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const REFRESH_URL = "/api/accounts/token/refresh/";
export const unauthorizedEvent = new Event("unauthorized");
export const publicApiClient = axios.create({ baseURL: API_URL });
const apiClient = axios.create({ baseURL: API_URL });

type Session = { access: string | null; refresh: string | null; owner: string | null };
type ViewerConfig = InternalAxiosRequestConfig & { _viewerSession?: Session; _sentAccess?: string | null; _retry?: boolean };
export class SessionChangedError extends Error {
  constructor() { super("The viewer session changed. Please try again."); }
}

// Decoding only partitions local requests; the API verifies authentication.
function owner(token: string | null): string | null {
  if (!token) return null;
  try {
    const id = jwtDecode<{ user_id?: number | string }>(token).user_id;
    return id !== undefined && /^[1-9]\d*$/.test(String(id)) ? String(id) : null;
  } catch { return null; }
}
function session(): Session {
  const access = localStorage.getItem("access_token");
  const refresh = localStorage.getItem("refresh_token");
  return { access, refresh, owner: owner(access) ?? owner(refresh) };
}
function currentSession(expected: Session): Session {
  const current = session();
  if (current.refresh !== expected.refresh || current.owner !== expected.owner || ((!expected.refresh || !expected.owner) && current.access !== expected.access)) throw new SessionChangedError();
  return current;
}
function expire(expected: Session) {
  const current = session();
  // An old failure must not log out a newer login or another request's refresh.
  if (current.access !== expected.access || current.refresh !== expected.refresh) return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  delete apiClient.defaults.headers.common.Authorization;
  document.dispatchEvent(unauthorizedEvent);
}

const refreshes = new Map<string, Promise<string>>();
function refreshAccess(expected: Session): Promise<string> {
  const key = `${expected.access}:${expected.refresh}`;
  const pending = refreshes.get(key);
  if (pending) return pending;
  const operation = (async () => {
    try {
      if (!expected.refresh || !expected.owner || owner(expected.refresh) !== expected.owner) {
        expire(expected);
        throw new SessionChangedError();
      }
      const result = await publicApiClient.post<{ access: string }>(REFRESH_URL, { refresh: expected.refresh }, { timeout: 15000 });
      const current = currentSession(expected);
      if (owner(result.data.access) !== expected.owner) throw new SessionChangedError();
      // The account-scoped progress client may have refreshed concurrently.
      if (current.access !== expected.access && current.access) return current.access;
      localStorage.setItem("access_token", result.data.access);
      return result.data.access;
    } catch (cause) {
      currentSession(expected);
      if (axios.isAxiosError(cause) && (cause.response?.status === 400 || cause.response?.status === 401)) expire(expected);
      // Network errors and server failures leave the session available to retry.
      throw cause;
    }
  })();
  refreshes.set(key, operation);
  void operation.finally(() => { if (refreshes.get(key) === operation) refreshes.delete(key); }).catch(() => {});
  return operation;
}

apiClient.interceptors.request.use((config: ViewerConfig) => {
  if (typeof window === "undefined") return config;
  delete apiClient.defaults.headers.common.Authorization;
  const current = config._viewerSession ? currentSession(config._viewerSession) : session();
  config._viewerSession ??= current;
  config._sentAccess = current.access;
  config.headers.delete("Authorization");
  if (current.access) config.headers.set("Authorization", `Bearer ${current.access}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as ViewerConfig;
    if (typeof window !== "undefined" && config._viewerSession) currentSession(config._viewerSession);
    return response;
  },
  async (error: unknown) => {
    if (typeof window === "undefined" || !axios.isAxiosError(error) || !error.config) throw error;
    const config = error.config as ViewerConfig;
    if (!config._viewerSession) throw error;
    const current = currentSession(config._viewerSession);
    if (error.response?.status !== 401) throw error;
    if (config._retry) {
      if (current.access === config._sentAccess) expire(current);
      throw error;
    }
    config._retry = true;
    if (current.access === config._sentAccess) await refreshAccess(current);
    currentSession(config._viewerSession);
    return apiClient(config);
  },
);

export default apiClient;
