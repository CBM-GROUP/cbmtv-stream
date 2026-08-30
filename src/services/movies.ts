import { publicApiClient } from "./api";
import { API_Routes } from "@/lib/api-routes";
import { fetchAllPages } from "@/lib/fetchAllPages";
import type { Program } from "@/types";

/* Movies -- Content filtered to content_type=movie by the backend. */
export const listMovies = () =>
  fetchAllPages<Program>(publicApiClient, API_Routes.listMovies);
