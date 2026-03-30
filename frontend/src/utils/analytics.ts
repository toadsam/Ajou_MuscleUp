const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function logEvent(page: string, action: string, metadata?: Record<string, unknown>) {
  let actorEmail: string | undefined;
  let actorNickname: string | undefined;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const parsed = JSON.parse(raw) as { email?: string; nickname?: string };
      actorEmail = parsed.email;
      actorNickname = parsed.nickname;
    }
  } catch {
    // ignore local storage parse errors
  }

  const payloadMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
    ...(actorEmail ? { actorEmail } : {}),
    ...(actorNickname ? { actorNickname } : {}),
  };

  try {
    await fetch(`${API_BASE}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ page, action, metadata: JSON.stringify(payloadMetadata) }),
    });
  } catch (e) {
    // swallow errors to avoid blocking UX
    console.warn("analytics log failed", e);
  }
}
