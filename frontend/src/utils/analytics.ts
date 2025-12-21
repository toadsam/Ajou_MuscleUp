const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function logEvent(page: string, action: string, metadata?: Record<string, unknown>) {
  try {
    await fetch(`${API_BASE}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ page, action, metadata: metadata ? JSON.stringify(metadata) : undefined }),
    });
  } catch (e) {
    // swallow errors to avoid blocking UX
    console.warn("analytics log failed", e);
  }
}
