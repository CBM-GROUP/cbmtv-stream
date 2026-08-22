import apiClient, { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";
import { Channel, CreateChannelData, UpdateChannelData } from "@/types";

type ChannelListResponse =
  | Channel[]
  | {
      results?: Channel[];
    };

// /api/channels/ is paginated by DRF, so the payload is {count, results: []},
// not a bare array. Unwrap it here the same way listContent does, so callers
// always get an array to map over.
function normalizeChannelList(data: ChannelListResponse): Channel[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.results) ? data.results : [];
}

/* Channels */
export const createChannel = (data: CreateChannelData) =>
  apiClient.post(API_Routes.createChannel, data);
export const listChannels = () =>
  publicApiClient
    .get<ChannelListResponse>(API_Routes.listChannels)
    .then((response) => normalizeChannelList(response.data));
export const getChannelById = (id: string | number) => {
  return publicApiClient.get(
    API_Routes.getChannelById.replace("{{channel_id}}", String(id))
  );
};
export const updateChannel = (id: string | number, data: UpdateChannelData) =>
  apiClient.put(
    API_Routes.updateChannel.replace("{{channel_id}}", String(id)),
    data
  );
export const deleteChannel = (id: string | number) =>
  apiClient.delete(
    API_Routes.deleteChannel.replace("{{channel_id}}", String(id))
  );
