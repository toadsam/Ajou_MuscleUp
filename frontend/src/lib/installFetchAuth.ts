const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const RETRY_HEADER = "x-auth-retry";

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
    return res.ok;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input);
    const effectiveInit: RequestInit =
      isApiRequest(url) ? { ...init, credentials: init?.credentials ?? "include" } : { ...init };
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
        [RETRY_HEADER]: "1",
      },
    });
  };
}
