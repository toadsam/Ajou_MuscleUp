import { createHmac, timingSafeEqual } from "crypto";

/**
 * Realtime ticket verification.
 *
 * The backend (POST /api/realtime/ticket, RealtimeTicketController.java) signs a short-lived
 * ticket: base64url(JSON claims) + "." + base64url(HMAC-SHA256(claimsPart, secret)).
 * The client passes it in the socket.io handshake (`auth: { ticket }`).
 * Identity and public profile (nickname, level, tier, avatar, friend ids) come ONLY from here.
 *
 * Secret: REALTIME_TICKET_SECRET (>= 32 chars), same value as the backend.
 *  - set                                   -> "ticket" mode (every socket must present a valid ticket)
 *  - missing and NODE_ENV === "production" -> "disabled" (all sockets rejected, error logged)
 *  - missing otherwise (local dev)         -> "dev" mode: tickets are verified with the shared
 *    development secret (same as the backend's DEV_SECRET), and sockets WITHOUT a ticket may join
 *    as unverified guests (used by bench/lounge-ramp.mjs). A warning is logged.
 */

export type TicketClaims = {
  v: number;
  uid: number;
  pid: string;
  nick: string;
  lv: number;
  tier: string;
  stage: number;
  gender: string | null;
  seed: string | null;
  style: string | null;
  rest: boolean;
  gp: Record<string, unknown> | null;
  fr: number[];
  /** lounge room: "square" | "gym:{id}" (older tickets: missing = square) */
  room?: string;
  /** room display name ("광장" or the gym name) */
  rname?: string;
  iat: number;
  exp: number;
};

export type AuthMode = "ticket" | "dev" | "disabled";

const DEV_SECRET = "muscleup-dev-only-realtime-ticket-secret";
const CLOCK_SKEW_SECONDS = 30;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

const configuredSecret = (process.env.REALTIME_TICKET_SECRET ?? "").trim();

export const authMode: AuthMode =
  configuredSecret.length >= 32 ? "ticket" : IS_PRODUCTION ? "disabled" : "dev";

const secret = authMode === "ticket" ? configuredSecret : DEV_SECRET;

if (authMode === "disabled") {
  console.error(
    "[lounge] REALTIME_TICKET_SECRET is missing or shorter than 32 chars in production. All connections will be rejected."
  );
} else if (authMode === "dev") {
  console.warn(
    "[lounge] REALTIME_TICKET_SECRET not set. Development mode: using the dev-only secret and allowing unverified guest joins. Never run like this in production."
  );
}

const b64urlDecode = (value: string) => Buffer.from(value, "base64url");

export function verifyTicket(raw: unknown): TicketClaims | null {
  if (authMode === "disabled") return null;
  if (typeof raw !== "string" || raw.length > 16_000) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot !== raw.lastIndexOf(".")) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  const expected = createHmac("sha256", secret).update(body, "ascii").digest();
  let given: Buffer;
  try {
    given = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let claims: any;
  try {
    claims = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object" || claims.v !== 1) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
  if (!Number.isFinite(claims.iat) || claims.iat - CLOCK_SKEW_SECONDS > now) return null;
  if (!Number.isSafeInteger(claims.uid) || claims.uid <= 0) return null;
  if (typeof claims.pid !== "string" || !/^p[0-9a-f]{16}$/.test(claims.pid)) return null;
  if (typeof claims.nick !== "string") return null;
  if (!Array.isArray(claims.fr)) return null;
  claims.fr = claims.fr.filter((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0).slice(0, 500);
  return claims as TicketClaims;
}
