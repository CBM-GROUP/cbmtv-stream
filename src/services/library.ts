import apiClient from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { ProgressPayload, SavedItem, WatchProgress } from "@/types";

export const listSavedItems = (signal?: AbortSignal) => fetchAllPages<SavedItem>(apiClient, `${API_Routes.savedItems}?page_size=100`, 50, { signal, timeout: 15000 });
export const getSavedIds = async (signal?: AbortSignal) => (await apiClient.get<number[]>(API_Routes.savedIds, { signal, timeout: 15000 })).data;
export const saveItem = async (content: number) => (await apiClient.post<SavedItem>(API_Routes.savedItems, { content }, { timeout: 15000 })).data;
export const removeSavedItem = (content: number) => apiClient.delete(buildPath(API_Routes.savedItem, { content_id: content }), { timeout: 15000 });
export const listWatchProgress = (signal?: AbortSignal) => fetchAllPages<WatchProgress>(apiClient, `${API_Routes.watchProgress}?include_completed=true&page_size=100`, 50, { signal, timeout: 15000 });
export const recordProgress = async (payload: ProgressPayload) => (await apiClient.post<WatchProgress>(API_Routes.watchProgress, payload, { timeout: 15000, adapter: "fetch", fetchOptions: { keepalive: true } })).data;
export const removeWatchProgress = (content: number) => apiClient.delete(buildPath(API_Routes.watchProgressItem, { content_id: content }), { timeout: 15000 });
