import { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";

/* Movies */
export const listMovies = () => {
  return publicApiClient.get(API_Routes.listMovies).then((response) => {
    return response.data;
  });
};
