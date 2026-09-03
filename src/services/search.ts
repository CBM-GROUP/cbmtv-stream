import { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";
import type { Program } from "@/types";

/**
 * Response shape of `GET /api/content/search/`.
 *
 * `hits` are full Content rows serialized from the database, not documents
 * echoed back from the search index. `source` reports which path answered --
 * "meilisearch" when the index ranked the results, "database" when the view
 * fell back to an icontains query, "none" for an empty term.
 */
export interface SearchResponse {
  query: string;
  count: number;
  hits: Program[];
  source: "meilisearch" | "database" | "none";
}

/**
 * Search the catalogue through the Django API.
 *
 * The browser used to hold a Meilisearch client and query the search engine
 * directly, which meant shipping an API key to every visitor -- and the key in
 * use was the *master* key, so any reader could delete the index. It also meant
 * the client trusted index documents as content: a stale index sent viewers to
 * whatever programme now owned that id. Going through Django fixes both. The
 * database is authoritative for what comes back.
 *
 * `publicApiClient`, never the default `apiClient`: search is anonymous, and
 * `apiClient` reads a 400 as an expired token and would turn a bad query into a
 * refresh attempt and possibly a logout.
 */
export const searchContent = async (
  query: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await publicApiClient.get<SearchResponse>(
    `${API_Routes.searchContent}?${params.toString()}`,
    { signal },
  );
  return response.data;
};
