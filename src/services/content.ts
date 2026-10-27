import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CreateContentData, UpdateContentData, Program, ContentType, ListResponse } from "@/types";
import { normalizeListResponse } from "@/lib/normalizeListResponse";
import { newestEligible } from "@/lib/catalogue";

// Home requests one page per category, never the entire catalogue.
export async function listContentPreview(content_type?: ContentType, signal?: AbortSignal, featured = false) {
  const params = new URLSearchParams({ page_size: "12" });
  if (content_type) params.set("content_type", content_type);
  if (featured) params.set("featured", "true");
  const { data } = await publicApiClient.get<ListResponse<Program>>(`${API_Routes.listContent}?${params}`, { signal });
  return newestEligible(normalizeListResponse<Program>(data));
}

export async function listCataloguePage(category?: ContentType, page = 1, signal?: AbortSignal) {
  const params = new URLSearchParams({ page_size: "24", page: String(page) });
  if (category) params.set("content_type", category);
  const { data } = await publicApiClient.get<ListResponse<Program>>(`${API_Routes.listContent}?${params}`, { signal });
  return {
    items: newestEligible(normalizeListResponse<Program>(data)),
    nextPage: !Array.isArray(data) && data.next ? page + 1 : undefined,
  };
}

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
