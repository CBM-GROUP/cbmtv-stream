import { useQueries, useQuery } from "@tanstack/react-query";
import { HOME_CATEGORIES, newestEligible } from "@/lib/catalogue";
import { listContentPreview } from "@/services/content";

export function useHomeCatalogue() {
  return useQueries({ queries: HOME_CATEGORIES.map(({ type, types }) => ({
    queryKey: ["home-category", type, types],
    queryFn: async ({ signal }: { signal: AbortSignal }) => newestEligible((await Promise.all(types.map((contentType) => listContentPreview(contentType, signal)))).flat()),
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
