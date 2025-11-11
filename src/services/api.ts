import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const REFRESH_URL = "/api/accounts/token/refresh/";

export const unauthorizedEvent = new Event("unauthorized");

export const publicApiClient = axios.create({
  baseURL: API_URL,
});

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use(function (config) {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      typeof window !== "undefined" &&
      (error.response?.status === 401 || error.response?.status === 400) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await axios.post(
          `${API_URL}${REFRESH_URL}`,
          JSON.stringify({
            refresh: refreshToken,
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const access_token = response.data.access;

        localStorage.setItem("access_token", access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response) {
          console.error("Error response data:", refreshError.response.data);
          console.error("Error response status:", refreshError.response.status);
          console.error(
            "Error response headers:",
            refreshError.response.headers
          );
        }

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        document.dispatchEvent(unauthorizedEvent);

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
