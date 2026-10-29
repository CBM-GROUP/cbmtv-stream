import { useInfiniteQuery } from "@tanstack/react-query";

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

  const queryResult = useInfiniteQuery({
    queryKey: ["search", term, limit],
    queryFn: ({ signal, pageParam }) => searchContent(term, limit, signal, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) => {
      const next = lastPage.next_offset;
      return Number.isSafeInteger(next) && (next as number) > lastOffset && lastPage.hits.length > 0 ? next as number : undefined;
    },
    enabled: term.length > 0,
    // Results for a given term rarely change within a session, and the same
    // term is re-typed constantly while backspacing.
    staleTime: 30_000,
    // A failed search should surface as an error state promptly rather than
    // hanging the dropdown through three silent retries.
    retry: 1,
  });
  const pages = queryResult.data?.pages;
  const hits = [...new Map((pages?.flatMap((page) => page.hits) ?? []).filter((hit) => hit.status === "approved").map((hit) => [hit.id, hit])).values()];
  const data: SearchResponse | undefined = pages?.length ? { ...pages[pages.length - 1], hits, count: hits.length } : undefined;
  return {
    ...queryResult, data,
    // Appending a page must keep the existing list and keyboard target visible.
    isFetching: queryResult.isFetching && !queryResult.isFetchingNextPage,
    isError: queryResult.isError && !queryResult.isFetchNextPageError,
  };
}
