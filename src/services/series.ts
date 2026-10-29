import { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { Episode, MiniSeries, Program, Season } from "@/types";

/* Series */

/**
 * `?content_type=series` was silently ignored by the backend until the Track 0A
 * filter fix, so this returned the entire catalogue.
 */
export const listSeries = () =>
  fetchAllPages<Program>(publicApiClient, API_Routes.listSeries);

export const getSeriesSeasons = (seriesId: string | number, signal?: AbortSignal) =>
  fetchAllPages<Season>(
    publicApiClient,
    buildPath(API_Routes.listSeasonsBySeriesId, { content_id: seriesId }),
    50, { signal, timeout: 15000 },
  );

export const getSeasonEpisodes = (seasonId: string | number, signal?: AbortSignal) =>
  fetchAllPages<Episode>(
    publicApiClient,
    buildPath(API_Routes.listEpisodesInSeason, { season_id: seasonId }),
    50, { signal, timeout: 15000 },
  );

export const getEpisode = async (id: number, signal?: AbortSignal) => (await publicApiClient.get<Episode>(buildPath(API_Routes.getEpisodeById, { episode_id: id }), { signal, timeout: 15000 })).data;

export const getMiniSeriesParts = (contentId: string | number, signal?: AbortSignal) =>
  fetchAllPages<MiniSeries>(
    publicApiClient,
    buildPath(API_Routes.listMiniSeriesByContentId, { content_id: contentId }),
    50, { signal, timeout: 15000 },
  );
