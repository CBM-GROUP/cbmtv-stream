import apiClient from "./api";
import { API_Routes } from "@/lib/api-routes";
import { CreateSeasonData, UpdateSeasonData } from "@/types";

/* Seasons */
export const listSeasonsBySeriesId = (seriesId: string | number) => apiClient.get(API_Routes.listSeasonsBySeriesId.replace('{{seriesID}}', String(seriesId)));
export const createSeason = (data: CreateSeasonData) => apiClient.post(API_Routes.createSeason, data);
export const updateSeason = (id: string | number, data: UpdateSeasonData) => apiClient.put(API_Routes.updateSeason.replace('{{season_id}}', String(id)), data);
export const getSeasonById = (id: string | number) => apiClient.get(API_Routes.getSeasonById.replace(/(\d+)\/$/, `${id}/`));
export const deleteSeason = (id: string | number) => apiClient.delete(API_Routes.deleteSeason.replace('{{season_id}}', String(id)));
