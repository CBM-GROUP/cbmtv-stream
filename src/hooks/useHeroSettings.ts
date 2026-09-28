"use client";

import { useQuery } from "@tanstack/react-query";
import { publicApiClient } from "@/services/api";
import { API_Routes } from "@/lib/api-routes";

type HeroSettings = { image_duration_seconds: number };

export function useHeroSettings() {
  return useQuery<HeroSettings>({
    queryKey: ["hero-settings"],
    queryFn: async () => {
      try {
        const response = await publicApiClient.get<HeroSettings>(API_Routes.heroSettings);
        return response.data;
      } catch {
        // An older backend does not have this endpoint yet.
        return { image_duration_seconds: 20 };
      }
    },
  });
}
