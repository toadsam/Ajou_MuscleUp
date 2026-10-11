import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { authMode, IS_PRODUCTION, verifyTicket, type TicketClaims } from "./auth.js";
import { SocketRateLimiter, type LimitCategory } from "./rateLimit.js";
import {
  addPlayer,
  getMapSize,
  getPlayer,
  getRoomName,
  listPlayers,
  removePlayer,
  takeMoves,
  updatePlayerPosition,
} from "./rooms.js";
import {
  GROWTH_PARAM_KEYS,
  type CharacterTier,
  type ClientExtras,
  type Gender,
  type GrowthParams,
  type PingPayload,
  type TypingPayload,
  type VerifiedProfile,
} from "./types.js";

const PORT = Number(process.env.PORT ?? 4001);
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
const ALLOWED_ORIGINS = ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

/** max size of one incoming socket.io message (default is 1MB). Voice chunks are ~2KB. */
const MAX_HTTP_BUFFER_SIZE = 48 * 1024;
const MAX_VOICE_BASE64 = 32_000;
const VOICE_RANGE = 260;
/** positions are batched and only changed players are sent */
const MOVES_BROADCAST_MS = 100;
const VOICE_LISTENERS_ROOM = "voice-listeners";

const roomName = getRoomName();
const mapSize = getMapSize();

if (IS_PRODUCTION && !process.env.ORIGIN) {
  console.warn("[lounge] ORIGIN is not set in production; only http://localhost:5173 is allowed by CORS.");
}

const httpServer = createServer((req, res) => {
  const origin = req.headers.origin ?? "";
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith("/status")) {
    const payload = {
      room: roomName,
      activePlayers: listPlayers().length,
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404);
  res.end();
});
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
});

// ── validation helpers ─────────────────────────────────────────────────────
const TIER_VALUES: CharacterTier[] = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];
const GENDER_VALUES: Gender[] = ["MALE", "FEMALE"];
const EMOTE_VALUES = ["wave", "cheer", "gg", "clap"];
const STICKER_VALUES = ["🔥", "💪", "👏", "🚀"];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g;

const cleanText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return undefined;
  const text = value.replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
  return text || undefined;
};

const asTier = (value: unknown): CharacterTier =>
  typeof value === "string" && TIER_VALUES.includes(value as CharacterTier)
    ? (value as CharacterTier)
    : "BRONZE";

const asGender = (value: unknown): Gender | undefined =>
  typeof value === "string" && GENDER_VALUES.includes(value as Gender) ? (value as Gender) : undefined;

const asInt = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value as number))) : fallback;

/** only the 19 known numeric keys, each clamped. Anything else is dropped. */
const sanitizeGrowthParams = (value: unknown): GrowthParams | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const out = {} as GrowthParams;
  for (const key of GROWTH_PARAM_KEYS) {
    const n = source[key];
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    out[key] = Math.min(10, Math.max(-10, Math.round(n * 1000) / 1000));
  }
  return out;
};

const profileFromTicket = (claims: TicketClaims): VerifiedProfile => ({
  id: claims.pid,
  nickname: cleanText(claims.nick, 30) ?? "회원",
  level: asInt(claims.lv, 1, 9999, 1),
  tier: asTier(claims.tier),
  evolutionStage: asInt(claims.stage, 0, 99, 0),
  gender: asGender(claims.gender),
  avatarSeed: cleanText(claims.seed, 64),
  stylePreset: cleanText(claims.style, 32),
  isResting: claims.rest === true,
  growthParams: sanitizeGrowthParams(claims.gp),
});

/** dev mode only (no secret, not production): unverified guest profile from the client payload */
const profileFromGuestPayload = (socketId: string, payload: any): VerifiedProfile => ({
  id: `guest-${socketId.slice(0, 8)}`,
  nickname: cleanText(payload?.nickname, 30) ?? "게스트",
  level: asInt(payload?.level, 1, 9999, 1),
  tier: asTier(payload?.tier),
  evolutionStage: asInt(payload?.evolutionStage, 0, 99, 0),
  gender: asGender(payload?.gender),
  avatarSeed: cleanText(payload?.avatarSeed, 64),
  stylePreset: cleanText(payload?.stylePreset, 32),
  isResting: payload?.isResting === true,
  growthParams: sanitizeGrowthParams(payload?.growthParams),
});

/** cosmetic, self-described fields (not security relevant) — whitelisted and length-limited */
const extrasFromPayload = (payload: any): ClientExtras => {
  const mbti = typeof payload?.mbti === "string" ? payload.mbti.trim().toUpperCase() : "";
  const progress = cleanText(payload?.activeEventProgress, 20);
  return {
    mbti: /^[EI][NS][TF][JP]$/.test(mbti) ? mbti : undefined,
    recentAttendanceCount: Number.isFinite(payload?.recentAttendanceCount)
      ? asInt(payload.recentAttendanceCount, 0, 366, 0)
      : undefined,
    activeEventTitle: cleanText(payload?.activeEventTitle, 40),
    activeEventProgress: progress && /^\d{1,4}\/\d{1,4}$/.test(progress) ? progress : undefined,
  };
};

// ── broadcasting ────────────────────────────────────────────────────────────
/** full list: only on join / leave / profile change */
const broadcastPlayers = () => {
  io.to(roomName).emit("lounge:players", { players: listPlayers() });
};

/** positions: only players that moved, at most every MOVES_BROADCAST_MS */
setInterval(() => {
  const moves = takeMoves();
  if (moves.length === 0) return;
  io.to(roomName).emit("lounge:moves", { moves });
}, MOVES_BROADCAST_MS);

// ── authentication (handshake) ──────────────────────────────────────────────
io.use((socket, next) => {
  if (authMode === "disabled") {
    next(new Error("realtime_unavailable"));
    return;
  }
  const ticket = (socket.handshake.auth as Record<string, unknown> | undefined)?.ticket;
  if (ticket !== undefined && ticket !== null && ticket !== "") {
    const claims = verifyTicket(ticket);
    if (!claims) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.identity = claims;
    next();
    return;
  }
  if (authMode === "dev") {
    socket.data.identity = null; // unverified guest (development only)
    next();
    return;
  }
  next(new Error("unauthorized"));
});

const nicknameOf = (socket: Socket) => getPlayer(socket.id)?.nickname ?? "회원";

io.on("connection", (socket) => {
  const identity = socket.data.identity as TicketClaims | null;
  const limiter = new SocketRateLimiter();
  const friendIds = new Set<number>(identity?.fr ?? []);

  /** wraps a handler with the rate limiter; abusive sockets are disconnected */
  const on = (event: string, category: LimitCategory, handler: (payload: any) => void) => {
    socket.on(event, (payload: unknown) => {
      if (!limiter.take(category)) {
        if (limiter.abusive) {
          console.warn(`[lounge] disconnect abusive socket ${socket.id}`);
          socket.disconnect(true);
        }
        return;
      }
      try {
        handler(payload);
      } catch (err) {
        console.error(`[lounge] handler ${event} failed`, err);
      }
    });
  };

  const joined = () => socket.rooms.has(roomName) && Boolean(getPlayer(socket.id));

  /** party/voice targets must be players currently in the lounge */
  const targetSocketId = (payload: any) => {
    if (!payload || typeof payload.toSocketId !== "string") return null;
    const toSocketId = payload.toSocketId.trim();
    if (!toSocketId || toSocketId === socket.id || !getPlayer(toSocketId)) return null;
    return toSocketId;
  };

  if (identity) {
    socket.join(`user:${identity.uid}`);
  }

  // ── friend DM notice ────────────────────────────────────────────────────
  // Messages themselves are saved and read through REST (/api/friends/chat/...), which checks
  // friendship. The socket only tells the friend "a new message arrived, refetch".
  on("friend:notify", "friend", (payload) => {
    if (!identity) return;
    const peerId = payload?.peerId;
    const messageId = payload?.messageId;
    if (!Number.isSafeInteger(peerId) || !friendIds.has(peerId)) return;
    if (!Number.isSafeInteger(messageId) || messageId <= 0) return;
    io.to(`user:${peerId}`).emit("friend:notice", {
      fromUserId: identity.uid,
      messageId,
    });
  });

  // ── lounge ──────────────────────────────────────────────────────────────
  on("lounge:join", "join", (payload) => {
    if (!payload || typeof payload !== "object") return;
    const profile = identity
      ? profileFromTicket(identity)
      : profileFromGuestPayload(socket.id, payload);
    const player = addPlayer(socket.id, profile, extrasFromPayload(payload));
    socket.join(roomName);
    console.log(`[lounge] join ${player.id} level=${player.level} tier=${player.tier}`);
    broadcastPlayers();
    socket.emit("lounge:welcome", { mapSize });
  });

  on("player:move", "move", (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    updatePlayerPosition(socket.id, payload.x, payload.y);
  });

  on("chat:send", "chat", (payload) => {
    if (!joined()) return;
    const message = cleanText(payload?.message, 200);
    if (!message) return;
    io.to(roomName).emit("chat:message", {
      nickname: nicknameOf(socket),
      message,
      ts: new Date().toISOString(),
    });
  });

  on("chat:typing", "typing", (payload: TypingPayload) => {
    if (!joined()) return;
    if (!payload || typeof payload.isTyping !== "boolean") return;
    socket.to(roomName).emit("chat:typing", {
      nickname: nicknameOf(socket),
      isTyping: payload.isTyping,
    });
  });

  on("social:emote", "social", (payload) => {
    if (!joined()) return;
    const emote = typeof payload?.emote === "string" ? payload.emote.trim() : "";
    if (!EMOTE_VALUES.includes(emote)) return;
    io.to(roomName).emit("social:emote", {
      fromSocketId: socket.id,
      nickname: nicknameOf(socket),
      emote,
      ts: Date.now(),
    });
  });

  on("social:sticker", "social", (payload) => {
    if (!joined()) return;
    const sticker = typeof payload?.sticker === "string" ? payload.sticker.trim() : "";
    if (!STICKER_VALUES.includes(sticker)) return;
    io.to(roomName).emit("social:sticker", {
      fromSocketId: socket.id,
      nickname: nicknameOf(socket),
      sticker,
      ts: Date.now(),
    });
  });

  // ── proximity voice: only to listeners who turned voice on, within range ──
  on("voice:listen", "voiceListen", (payload) => {
    if (payload?.enabled === true) socket.join(VOICE_LISTENERS_ROOM);
    else socket.leave(VOICE_LISTENERS_ROOM);
  });

  on("voice:chunk", "voice", (payload) => {
    if (!joined()) return;
    if (!payload || typeof payload.audioBase64 !== "string") return;
    if (payload.audioBase64.length === 0 || payload.audioBase64.length > MAX_VOICE_BASE64) return;
    const mimeType =
      typeof payload.mimeType === "string" && /^audio\/[a-z0-9.+-]+(;\s*codecs=[a-z0-9.,-]+)?$/i.test(payload.mimeType)
        ? payload.mimeType.slice(0, 60)
        : "audio/webm";
    const me = getPlayer(socket.id);
    if (!me) return;
    const listeners = io.sockets.adapter.rooms.get(VOICE_LISTENERS_ROOM);
    if (!listeners) return;
    const message = {
      fromSocketId: socket.id,
      nickname: me.nickname,
      audioBase64: payload.audioBase64,
      mimeType,
      ts: Date.now(),
    };
    for (const listenerId of listeners) {
      if (listenerId === socket.id) continue;
      const other = getPlayer(listenerId);
      if (!other) continue;
      if (Math.hypot(other.x - me.x, other.y - me.y) > VOICE_RANGE) continue;
      io.to(listenerId).emit("voice:chunk", message);
    }
  });

  // ── party ───────────────────────────────────────────────────────────────
  on("party:follow-request", "party", (payload) => {
    if (!joined()) return;
    const toSocketId = targetSocketId(payload);
    if (!toSocketId) return;
    io.to(toSocketId).emit("party:follow-request", {
      fromSocketId: socket.id,
      nickname: nicknameOf(socket),
      ts: Date.now(),
    });
  });

  on("party:follow-response", "party", (payload) => {
    if (!joined()) return;
    const toSocketId = targetSocketId(payload);
    if (!toSocketId) return;
    io.to(toSocketId).emit("party:follow-response", {
      fromSocketId: socket.id,
      accepted: payload.accepted === true,
      ts: Date.now(),
    });
  });

  on("party:teleport-request", "party", (payload) => {
    if (!joined()) return;
    const toSocketId = targetSocketId(payload);
    if (!toSocketId) return;
    io.to(toSocketId).emit("party:teleport-request", {
      fromSocketId: socket.id,
      nickname: nicknameOf(socket),
      ts: Date.now(),
    });
  });

  on("party:teleport-response", "party", (payload) => {
    if (!joined()) return;
    const toSocketId = targetSocketId(payload);
    if (!toSocketId) return;
    // the destination is the responder's own position as the server knows it, not a client value
    const me = getPlayer(socket.id);
    const accepted = payload.accepted === true;
    io.to(toSocketId).emit("party:teleport-response", {
      fromSocketId: socket.id,
      accepted,
      x: accepted ? me?.x : undefined,
      y: accepted ? me?.y : undefined,
      ts: Date.now(),
    });
  });

  on("ping:check", "ping", (payload: PingPayload) => {
    if (!payload || !Number.isFinite(payload.clientTs)) return;
    socket.emit("ping:result", { clientTs: payload.clientTs, serverTs: Date.now() });
  });

  socket.on("disconnect", () => {
    if (removePlayer(socket.id)) broadcastPlayers();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[lounge] realtime server listening on ${PORT} (auth: ${authMode})`);
});
