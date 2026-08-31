import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CreateContentData, UpdateContentData, Program } from "@/types";

/* Content */

/**
 * Every content row, following DRF's `next` links.
 *
 * This used to read page one and stop, which capped the catalogue at ten
 * regardless of `count`.
 */
export const listContent = () =>
  fetchAllPages<Program>(publicApiClient, API_Routes.listContent);

/** Content filtered server-side. Requires the Track 0A filter fix to be deployed. */
export const listContentBy = (
  filters: { channel?: number; content_type?: string; genre?: string } = {},
) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && `${value}` !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchAllPages<Program>(publicApiClient, `${API_Routes.listContent}${suffix}`);
};

export const getContentById = (id: string | number) =>
  publicApiClient.get<Program>(
    buildPath(API_Routes.getContentById, { content_id: id }),
  );

export const createContent = (data: CreateContentData) =>
  apiClient.post<Program>(API_Routes.createContent, data);

export const updateContent = (id: string | number, data: UpdateContentData) =>
  apiClient.put<Program>(buildPath(API_Routes.updateContent, { content_id: id }), data);

export const deleteContent = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteContent, { content_id: id }));
