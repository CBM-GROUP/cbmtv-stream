import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { Channel, CreateChannelData, Program, UpdateChannelData } from "@/types";

/* Channels */

export const listChannels = () =>
  fetchAllPages<Channel>(publicApiClient, API_Routes.listChannels);

export const getChannelById = (id: string | number) =>
  publicApiClient.get<Channel>(
    buildPath(API_Routes.getChannelById, { channel_id: id }),
  );

/** Content under one channel, via the viewset's paginated `contents` action. */
export const listChannelContents = (id: string | number) =>
  fetchAllPages<Program>(
    publicApiClient,
    buildPath(API_Routes.listChannelContents, { channel_id: id }),
  );

export const createChannel = (data: CreateChannelData) =>
  apiClient.post<Channel>(API_Routes.createChannel, data);

export const updateChannel = (id: string | number, data: UpdateChannelData) =>
  apiClient.put<Channel>(buildPath(API_Routes.updateChannel, { channel_id: id }), data);

export const deleteChannel = (id: string | number) =>
  apiClient.delete(buildPath(API_Routes.deleteChannel, { channel_id: id }));
