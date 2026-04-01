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

function getStoredRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { refreshToken?: string };
    return parsed?.refreshToken ?? null;
  } catch {
    return null;
  }
}

function setStoredTokens(accessToken: string, refreshToken?: string | null) {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.accessToken = accessToken;
    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      parsed.refreshToken = refreshToken;
    }
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
      const refreshToken = getStoredRefreshToken();
      const refreshRes = await api.post<{ accessToken?: string; token?: string; refreshToken?: string }>(
        "/api/auth/refresh",
        undefined,
        {
          headers: refreshToken ? { Authorization: `Bearer ${refreshToken}` } : undefined,
        },
      );
      const accessToken = refreshRes.data?.accessToken || refreshRes.data?.token;
      if (accessToken) {
        setStoredTokens(accessToken, refreshRes.data?.refreshToken);
      }
      waiters.forEach((resolve) => resolve(true));
      waiters = [];
      return api(originalRequest);
    } catch (refreshError) {
      waiters.forEach((resolve) => resolve(false));
      waiters = [];
      // Safari can intermittently miss refresh cookies even when local
      // access token is still valid. Avoid immediate local sign-out here.
      return Promise.reject(refreshError);
    } finally {
      refreshing = false;
    }
  }
);
