import apiClient, { publicApiClient } from "./api";
import { API_Routes, buildPath } from "@/lib/api-routes";
import type {
  AssignAdminData,
  GoogleDirectLoginData,
  GoogleLoginResponse,
  LoginData,
  LoginResponse,
  RegisterData,
  User,
  UserProfile,
} from "@/types";

/* Accounts */

/**
 * Registration is an anonymous action, so it goes through publicApiClient.
 * apiClient's response interceptor treats 400 as an expired-token signal and
 * tries to refresh, which turned ordinary field validation errors into a
 * confusing logout attempt.
 */
export const registerUser = (data: RegisterData) =>
  publicApiClient.post<User>(API_Routes.registerUser, data);

export const login = (data: LoginData) =>
  publicApiClient.post<LoginResponse>(API_Routes.userLogin, data);

export const googleDirectLogin = (data: GoogleDirectLoginData) =>
  publicApiClient.post<GoogleLoginResponse>(API_Routes.googleDirectLogin, data);

export const getUserProfile = () =>
  apiClient.get<UserProfile>(API_Routes.userProfile);

export const updateUser = (id: string | number, data: Partial<RegisterData>) =>
  apiClient.patch<User>(buildPath(API_Routes.updateUser, { user_id: id }), data);

export const changeUserPassword = (
  id: string | number,
  data: { current_password: string; new_password: string; confirm_password: string },
) => apiClient.post(buildPath(API_Routes.changeUserPassword, { user_id: id }), data);

export const assignAdmin = (data: AssignAdminData) =>
  apiClient.post(API_Routes.assignAdmin, data);

export const getUsers = () => apiClient.get<User[]>(API_Routes.getUsers);
