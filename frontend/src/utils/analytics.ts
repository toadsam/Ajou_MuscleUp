const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const USE_CREDENTIALS = import.meta.env.VITE_USE_CREDENTIALS === "true";

export async function logEvent(page: string, action: string, metadata?: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: USE_CREDENTIALS ? "include" : "same-origin",
      body: JSON.stringify({ page, action, metadata: metadata ? JSON.stringify(metadata) : undefined }),
    });
  } catch (e) {
    // swallow errors to avoid blocking UX
    console.warn("analytics log failed", e);
  }
}
