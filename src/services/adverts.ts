import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { normalizeListResponse } from "@/lib/normalizeListResponse";
import type { Advert, CreateAdData, ListResponse, UpdateAdData } from "@/types";

/* Adverts */

/**
 * ContentAdvertListCreateView sets no `pagination_class`, so this endpoint
 * returns a bare array rather than {count, results}. normalizeListResponse
 * absorbs both, so callers get an array either way and nothing breaks if
 * pagination is added later.
 *
 * Reads through publicApiClient: the endpoint is AllowAny, and the lander needs
 * it while logged out.
 */
export const listAds = () =>
  publicApiClient
    .get<ListResponse<Advert>>(API_Routes.listAds)
    .then((response) => normalizeListResponse<Advert>(response.data));

export const getAdById = (id: string | number) =>
  publicApiClient.get<Advert>(buildPath(API_Routes.getAdById, { advert_id: id }));

export const createAd = (data: CreateAdData) =>
  apiClient.post<Advert>(API_Routes.createAd, data);

export const updateAd = (id: string | number, data: UpdateAdData) =>
  apiClient.put<Advert>(buildPath(API_Routes.updateAd, { advert_id: id }), data);

/**
 * Previously "/api/content/adverts/3/" patched by a trailing-digits regex. A
 * missed substitution deleted advert 3.
 */
export const deleteAd = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteAd, { advert_id: id }));
