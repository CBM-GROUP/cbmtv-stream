import apiClient, { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";
import { CreateContentData, UpdateContentData, Program } from "@/types";

type ContentListResponse =
  | Program[]
  | {
      results?: Program[];
    };

function normalizeContentList(data: ContentListResponse): Program[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.results) ? data.results : [];
}

/* Content */
export const listContent = () =>
  publicApiClient
    .get<ContentListResponse>(API_Routes.listContent)
    .then((response) => normalizeContentList(response.data));
export const createContent = (data: CreateContentData) => apiClient.post(API_Routes.createContent, data);
export const getContentById = (id: string | number) => publicApiClient.get(API_Routes.getContentById.replace('{{content_id}}', String(id)));
export const updateContent = (id: string | number, data: UpdateContentData) => apiClient.put(API_Routes.updateContent.replace('{{new_content_id}}', String(id)), data);
export const deleteContent = (id: string | number) => apiClient.delete(API_Routes.deleteContent.replace('{{new_content_id}}', String(id)));
