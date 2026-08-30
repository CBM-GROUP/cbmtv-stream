import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { CreateSeasonData, Season, UpdateSeasonData } from "@/types";

/* Seasons */

export const listSeasonsBySeriesId = (seriesId: string | number) =>
  fetchAllPages<Season>(
    publicApiClient,
    buildPath(API_Routes.listSeasonsBySeriesId, { content_id: seriesId }),
  );

/**
 * Previously applied a trailing-digits regex to "/seasons/{{season_id}}/".
 * The token holds no digits, so the regex matched nothing and this requested
 * the literal path with the braces still in it.
 */
export const getSeasonById = (id: string | number) =>
  publicApiClient.get<Season>(buildPath(API_Routes.getSeasonById, { season_id: id }));

export const createSeason = (data: CreateSeasonData) =>
  apiClient.post<Season>(API_Routes.createSeason, data);

export const updateSeason = (id: string | number, data: UpdateSeasonData) =>
  apiClient.put<Season>(buildPath(API_Routes.updateSeason, { season_id: id }), data);

export const deleteSeason = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteSeason, { season_id: id }));
