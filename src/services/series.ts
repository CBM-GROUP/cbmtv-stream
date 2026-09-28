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

export const getSeriesSeasons = (seriesId: string | number) =>
  fetchAllPages<Season>(
    publicApiClient,
    buildPath(API_Routes.listSeasonsBySeriesId, { content_id: seriesId }),
  );

export const getSeasonEpisodes = (seasonId: string | number) =>
  fetchAllPages<Episode>(
    publicApiClient,
    buildPath(API_Routes.listEpisodesInSeason, { season_id: seasonId }),
  );

export const getMiniSeriesParts = (contentId: string | number) =>
  fetchAllPages<MiniSeries>(
    publicApiClient,
    buildPath(API_Routes.listMiniSeriesByContentId, { content_id: contentId }),
  );
