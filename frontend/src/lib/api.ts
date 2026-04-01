import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}

function setStoredAccessToken(token: string) {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.accessToken = token;
    localStorage.setItem("user", JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

let refreshing = false;
let waiters: Array<(success: boolean) => void> = [];

function isRefreshRequest(url?: string): boolean {
  return typeof url === "string" && url.includes("/api/auth/refresh");
}

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (
      !error?.response ||
      error.response.status !== 401 ||
      originalRequest?._retry ||
      isRefreshRequest(originalRequest?.url)
    ) {
      return Promise.reject(error);
    }

    if (refreshing) {
      const refreshed = await new Promise<boolean>((resolve) => waiters.push(resolve));
      if (!refreshed) {
        return Promise.reject(error);
      }
      return api(originalRequest);
    }

    refreshing = true;
    originalRequest._retry = true;
    try {
      const refreshRes = await api.post<{ accessToken?: string }>("/api/auth/refresh");
      if (refreshRes.data?.accessToken) {
        setStoredAccessToken(refreshRes.data.accessToken);
      }
      waiters.forEach((resolve) => resolve(true));
      waiters = [];
      return api(originalRequest);
    } catch (refreshError) {
      waiters.forEach((resolve) => resolve(false));
      waiters = [];
      localStorage.removeItem("user");
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      refreshing = false;
    }
  }
);
