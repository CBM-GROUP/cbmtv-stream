import apiClient from "./api";
import { API_Routes } from "@/lib/api-routes";

/* Series */
export const listSeries = () => apiClient.get(API_Routes.listSeries);

export const getSeriesSeasons = (seriesId: string | number) => apiClient.get(API_Routes.listSeasonsBySeriesId.replace('{{seriesID}}', String(seriesId)));

export const getSeasonEpisodes = (seasonId: string | number) => apiClient.get(API_Routes.getSeriesEpisodes.replace('{{season_id}}', String(seasonId)));

