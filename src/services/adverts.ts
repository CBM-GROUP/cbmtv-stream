import apiClient from "./api";
import { API_Routes } from "@/lib/api-routes";
import { CreateAdData, UpdateAdData } from "@/types";

/* Adverts */
export const createAd = (data: CreateAdData) => apiClient.post(API_Routes.createAd, data);
export const listAds = () => apiClient.get(API_Routes.listAds);
export const updateAd = (id: string | number, data: UpdateAdData) => apiClient.put(API_Routes.updateAd.replace('{{advert_id}}', String(id)), data);
export const deleteAd = (id: string | number) => apiClient.delete(API_Routes.deleteAd.replace(/(\d+)\/$/, `${id}/`));
export const getAdById = (id: string | number) => apiClient.get(API_Routes.getAdById.replace('{{advert_id}}', String(id)));
