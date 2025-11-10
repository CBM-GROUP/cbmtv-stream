import apiClient, { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";
import { CreateChannelData, UpdateChannelData } from "@/types";

/* Channels */
export const createChannel = (data: CreateChannelData) =>
  apiClient.post(API_Routes.createChannel, data);
export const listChannels = () => publicApiClient.get(API_Routes.listChannels);
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
