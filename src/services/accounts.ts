import apiClient from "./api";
import { API_Routes } from "@/lib/api-routes";
import { RegisterData, LoginData, AssignAdminData } from "@/types";

/* Accounts */
export const registerUser = (data: RegisterData) =>
  apiClient.post(API_Routes.registerUser, data);
export const login = (data: LoginData) => apiClient.post(API_Routes.userLogin, data);
export const getUserProfile = () => apiClient.get(API_Routes.userProfile);
export const assignAdmin = (data: AssignAdminData) =>
  apiClient.post(API_Routes.assignAdmin, data);
export const getUsers = () => apiClient.get(API_Routes.getUsers);
