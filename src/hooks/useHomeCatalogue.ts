import { useQueries, useQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/lib/catalogue";
import { listContentPreview } from "@/services/content";

export function useHomeCatalogue() {
  return useQueries({ queries: CATEGORIES.map(({ type }) => ({
    queryKey: ["content-preview", type],
    queryFn: ({ signal }: { signal: AbortSignal }) => listContentPreview(type, signal),
    staleTime: 60_000,
    retry: 1,
  })) });
}

export function useFeaturedContent() {
  return useQuery({
    queryKey: ["content-preview", "featured"],
    queryFn: ({ signal }) => listContentPreview(undefined, signal, true),
    staleTime: 60_000,
    retry: 1,
  });
}
