import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

let refreshing = false;
let waiters: Array<() => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (!error?.response || error.response.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    if (refreshing) {
      await new Promise<void>((resolve) => waiters.push(resolve));
      return api(originalRequest);
    }

    refreshing = true;
    originalRequest._retry = true;
    try {
      await api.post("/api/auth/refresh");
      waiters.forEach((resolve) => resolve());
      waiters = [];
      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem("user");
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      refreshing = false;
    }
  }
);
