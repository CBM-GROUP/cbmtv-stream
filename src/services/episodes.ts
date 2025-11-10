import apiClient from "./api";
import { API_Routes } from "@/lib/api-routes";
import { CreateEpisodeData, UpdateEpisodeData } from "@/types";

/* Episodes */
export const createEpisode = (data: CreateEpisodeData) => apiClient.post(API_Routes.createEpisode, data);
export const updateEpisode = (id: string | number, data: UpdateEpisodeData) => apiClient.put(API_Routes.updateEpisode.replace(/(\d+)\/$/, `${id}/`), data);
export const getEpisodeById = (id: string | number) => apiClient.get(API_Routes.getEpisodeById.replace(/(\d+)\/$/, `${id}/`));
export const listEpisodesInSeason = (seasonId: string | number) => apiClient.get(`${API_Routes.listEpisodesInSeason.split('?')[0]}?season=${seasonId}`);
export const deleteEpisode = (id: string | number) => apiClient.delete(API_Routes.deleteEpisode.replace('{{episode_id}}', String(id)));
