"use client";

import { useQuery } from "@tanstack/react-query";
import { publicApiClient } from "@/services/api";
import { API_Routes } from "@/lib/api-routes";

export type HeroSettings = { image_duration_seconds: number; display_mode: 'thumbnails_only' | 'thumbnail_trailer'; trailer_preview_seconds: number };
export const defaultHeroSettings: HeroSettings = { image_duration_seconds: 5, display_mode: 'thumbnail_trailer', trailer_preview_seconds: 20 };

export function useHeroSettings() {
  return useQuery<HeroSettings>({
    queryKey: ["hero-settings"],
    queryFn: async () => {
      try {
        const response = await publicApiClient.get<HeroSettings>(API_Routes.heroSettings);
        return { ...defaultHeroSettings, ...response.data };
      } catch {
        // An older backend does not have this endpoint yet.
        return defaultHeroSettings;
      }
    },
  });
}
