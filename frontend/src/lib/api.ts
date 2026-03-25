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
let waiters: Array<() => void> = [];

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
      const refreshRes = await api.post<{ accessToken?: string }>("/api/auth/refresh");
      if (refreshRes.data?.accessToken) {
        setStoredAccessToken(refreshRes.data.accessToken);
      }
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
