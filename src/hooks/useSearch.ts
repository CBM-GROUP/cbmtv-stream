import { useQuery } from "@tanstack/react-query";

import { searchContent, type SearchResponse } from "@/services/search";

/**
 * Debounced catalogue search.
 *
 * `query` is expected to be already debounced by the caller -- the input's
 * keystroke rate is a UI concern, not a cache key concern. An empty term is
 * never requested: `enabled` is false, so React Query holds the idle state
 * instead of firing a round trip that the API would answer with an empty list
 * anyway.
 */
export function useSearch(query: string, limit = 8) {
  const term = query.trim();

  return useQuery<SearchResponse>({
    queryKey: ["search", term, limit],
    queryFn: ({ signal }) => searchContent(term, limit, signal),
    enabled: term.length > 0,
    // Results for a given term rarely change within a session, and the same
    // term is re-typed constantly while backspacing.
    staleTime: 30_000,
    // A failed search should surface as an error state promptly rather than
    // hanging the dropdown through three silent retries.
    retry: 1,
  });
}
