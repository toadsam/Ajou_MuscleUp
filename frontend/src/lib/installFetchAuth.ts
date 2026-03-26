const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const RETRY_HEADER = "x-auth-retry";

function readUserRecord(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getAccessToken(): string | null {
  const user = readUserRecord();
  const token = user?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function setAccessToken(token: string) {
  const user = readUserRecord();
  if (!user) return;
  user.accessToken = token;
  localStorage.setItem("user", JSON.stringify(user));
}

type HeaderLike = HeadersInit | undefined;

function toHeadersObject(headers: HeaderLike): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function applyAuthHeader(url: string, headers: Record<string, string>): Record<string, string> {
  if (!isApiRequest(url)) return headers;
  const hasAuthorization =
    Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
  if (hasAuthorization) return headers;

  const token = getAccessToken();
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

function hasRetryMarker(input: RequestInfo | URL, init?: RequestInit): boolean {
  const initHeaders = toHeadersObject(init?.headers);
  if (initHeaders[RETRY_HEADER] === "1") return true;
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.headers.get(RETRY_HEADER) === "1";
  }
  return false;
}

function isRefreshRequest(url: string): boolean {
  return url.includes("/api/auth/refresh");
}

function isApiRequest(url: string): boolean {
  if (url.startsWith("http")) {
    return url.includes("/api/");
  }
  return url.startsWith("/api/");
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

export function installFetchAuth() {
  const globalAny = window as unknown as { __authFetchInstalled?: boolean };
  if (globalAny.__authFetchInstalled) return;
  globalAny.__authFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);
  let refreshPromise: Promise<boolean> | null = null;

  async function refreshAccessToken(): Promise<boolean> {
    const refreshUrl = API_BASE ? `${API_BASE}/api/auth/refresh` : "/api/auth/refresh";
    const res = await originalFetch(refreshUrl, {
      method: "POST",
      credentials: "include",
      headers: { [RETRY_HEADER]: "1" },
    });
    if (res.ok) {
      try {
        const payload = (await res.json()) as { accessToken?: string };
        if (payload?.accessToken) {
          setAccessToken(payload.accessToken);
        }
      } catch {
        // ignore non-JSON refresh responses
      }
    }
    return res.ok;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input);
    const effectiveInitHeaders = applyAuthHeader(url, toHeadersObject(init?.headers));
    const effectiveInit: RequestInit = isApiRequest(url)
      ? { ...init, credentials: init?.credentials ?? "include", headers: effectiveInitHeaders }
      : { ...init, headers: effectiveInitHeaders };
    const response = await originalFetch(input, effectiveInit);

    if (response.status !== 401) return response;
    if (!isApiRequest(url) || isRefreshRequest(url) || hasRetryMarker(input, init)) return response;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (!refreshed) return response;

    if (typeof Request !== "undefined" && input instanceof Request) {
      const retryRequest = new Request(input, {
        credentials: "include",
        headers: {
          ...toHeadersObject(input.headers),
          ...toHeadersObject(init?.headers),
          ...applyAuthHeader(url, {}),
          [RETRY_HEADER]: "1",
        },
      });
      return originalFetch(retryRequest);
    }

    return originalFetch(input, {
      ...init,
      credentials: "include",
      headers: {
        ...toHeadersObject(init?.headers),
        ...applyAuthHeader(url, {}),
        [RETRY_HEADER]: "1",
      },
    });
  };
}

export async function bootstrapAuthSession(): Promise<boolean> {
  const user = readUserRecord();
  if (!user) return false;
  const refreshUrl = API_BASE ? `${API_BASE}/api/auth/refresh` : "/api/auth/refresh";
  try {
    const res = await fetch(refreshUrl, {
      method: "POST",
      credentials: "include",
      headers: { [RETRY_HEADER]: "1" },
    });
    if (!res.ok) return false;
    try {
      const payload = (await res.json()) as { accessToken?: string };
      if (payload?.accessToken) {
        setAccessToken(payload.accessToken);
      }
    } catch {
      // ignore non-JSON refresh responses
    }
    return true;
  } catch {
    return false;
  }
}
