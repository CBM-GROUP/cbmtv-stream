import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CreateEpisodeData, Episode, UpdateEpisodeData } from "@/types";

/* Episodes */

export const listEpisodesInSeason = (seasonId: string | number) =>
  fetchAllPages<Episode>(
    publicApiClient,
    buildPath(API_Routes.listEpisodesInSeason, { season_id: seasonId }),
  );

/** Was "/api/content/episodes/2/" patched by regex -- a missed substitution read episode 2. */
export const getEpisodeById = (id: string | number) =>
  publicApiClient.get<Episode>(buildPath(API_Routes.getEpisodeById, { episode_id: id }));

export const createEpisode = (data: CreateEpisodeData) =>
  apiClient.post<Episode>(API_Routes.createEpisode, data);

/** Was "/api/content/episodes/2/" patched by regex -- a missed substitution overwrote episode 2. */
export const updateEpisode = (id: string | number, data: UpdateEpisodeData) =>
  apiClient.put<Episode>(buildPath(API_Routes.updateEpisode, { episode_id: id }), data);

export const deleteEpisode = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteEpisode, { episode_id: id }));
