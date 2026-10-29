import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CreateContentData, UpdateContentData, Program, ContentType, ListResponse } from "@/types";
import { normalizeListResponse } from "@/lib/normalizeListResponse";
import { newestEligible } from "@/lib/catalogue";

// Home requests one page per category, never the entire catalogue.
export async function listContentPreview(content_type?: ContentType, signal?: AbortSignal, featured = false, channel?: number) {
  const params = new URLSearchParams({ page_size: "12" });
  if (content_type) params.set("content_type", content_type);
  if (featured) params.set("featured", "true");
  if (channel) params.set("channel", String(channel));
  const { data } = await publicApiClient.get<ListResponse<Program>>(`${API_Routes.listContent}?${params}`, { signal, ...(channel ? { timeout: 15000 } : {}) });
  return newestEligible(normalizeListResponse<Program>(data));
}

export type CatalogueCursor = number | { series?: number; miniseries?: number };

export async function listCataloguePage(category?: ContentType, page: CatalogueCursor = 1, signal?: AbortSignal) {
  const fetchPage = async (type: ContentType | undefined, pageNumber: number) => {
    const params = new URLSearchParams({ page_size: "24", page: String(pageNumber) });
    if (type) params.set("content_type", type);
    const { data } = await publicApiClient.get<ListResponse<Program>>(`${API_Routes.listContent}?${params}`, { signal });
    return { items: normalizeListResponse<Program>(data), next: !Array.isArray(data) && Boolean(data.next) };
  };
  if (category === "series") {
    const cursor = typeof page === "number" ? { series: page, miniseries: page } : page;
    const [series, miniseries] = await Promise.all([
      cursor.series ? fetchPage("series", cursor.series) : undefined,
      cursor.miniseries ? fetchPage("miniseries", cursor.miniseries) : undefined,
    ]);
    const nextPage = {
      series: series?.next ? (cursor.series ?? 0) + 1 : undefined,
      miniseries: miniseries?.next ? (cursor.miniseries ?? 0) + 1 : undefined,
    };
    return {
      items: newestEligible([...(series?.items ?? []), ...(miniseries?.items ?? [])]),
      nextPage: nextPage.series || nextPage.miniseries ? nextPage : undefined,
    };
  }
  const pageNumber = typeof page === "number" ? page : 1;
  const response = await fetchPage(category, pageNumber);
  return { items: newestEligible(response.items), nextPage: response.next ? pageNumber + 1 : undefined };
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
    { timeout: 15000 },
  );

export const createContent = (data: CreateContentData) =>
  apiClient.post<Program>(API_Routes.createContent, data);

export const updateContent = (id: string | number, data: UpdateContentData) =>
  apiClient.put<Program>(buildPath(API_Routes.updateContent, { content_id: id }), data);

export const deleteContent = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteContent, { content_id: id }));
