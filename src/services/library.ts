import apiClient from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { SavedItem, WatchProgress, WatchProgressInput } from "@/types";

export const SavedService = {
  list: () => fetchAllPages<SavedItem>(apiClient, API_Routes.listSaved),
  ids: async () => (await apiClient.get<number[]>(API_Routes.savedIds)).data,
  add: async (contentId: number) =>
    (await apiClient.post<SavedItem>(API_Routes.listSaved, { content: contentId })).data,
  remove: async (contentId: number) => {
    await apiClient.delete(buildPath(API_Routes.savedItem, { content_id: contentId }));
  },
};

export const ProgressService = {
  list: () => fetchAllPages<WatchProgress>(apiClient, API_Routes.listProgress),
  save: async (input: WatchProgressInput) =>
    (await apiClient.post<WatchProgress>(API_Routes.listProgress, input)).data,
  remove: async (contentId: number) => {
    await apiClient.delete(buildPath(API_Routes.progressItem, { content_id: contentId }));
  },
};

/** Best effort for a browser exit, where an Axios request may be interrupted. */
export function saveProgressOnExit(input: WatchProgressInput, sessionToken: string | null) {
  const token = localStorage.getItem("access_token");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!sessionToken || token !== sessionToken || !base) return;
  void fetch(new URL(API_Routes.listProgress, base), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {});
}
