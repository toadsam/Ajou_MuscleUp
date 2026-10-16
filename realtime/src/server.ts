import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { authMode, IS_PRODUCTION, verifyTicket, type TicketClaims } from "./auth.js";
import { SocketRateLimiter, type LimitCategory } from "./rateLimit.js";
import {
  addPlayer,
  countPlayers,
  getMapSize,
  getPlayer,
  listPlayers,
  normalizeRoomKey,
  removePlayer,
  socketRoomOf,
  SQUARE_ROOM,
  takeMovesByRoom,
  updatePlayerPosition,
} from "./rooms.js";
import {
  GROWTH_PARAM_KEYS,
  type CharacterTier,
  type ClientExtras,
  type Gender,
  type GrowthParams,
  type PingPayload,
  type VerifiedProfile,
} from "./types.js";

const PORT = Number(process.env.PORT ?? 4001);
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
const ALLOWED_ORIGINS = ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

/** max size of one incoming socket.io message (default is 1MB). Voice chunks are ~2KB. */
const MAX_HTTP_BUFFER_SIZE = 48 * 1024;
/** positions are batched and only changed players are sent */
const MOVES_BROADCAST_MS = 100;

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
    // ?room=square | gym:{id} → 그 방 인원. 없으면 전체 인원(예전 응답과 같은 모양)
    const requested = new URL(req.url, "http://localhost").searchParams.get("room");
    const roomKey = requested ? normalizeRoomKey(requested) : undefined;
    const payload = {
      room: roomKey ?? "all",
      activePlayers: countPlayers(roomKey),
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
  isPumped: claims.pump === true,
  tank: typeof claims.tank === "string" && /^#[0-9A-Fa-f]{6}$/.test(claims.tank) ? claims.tank : undefined,
  title: cleanText(claims.ttl, 20),
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
/** full list of one room: only on join / leave / profile change */
const broadcastPlayers = (roomKey: string) => {
  io.to(socketRoomOf(roomKey)).emit("lounge:players", { players: listPlayers(roomKey) });
};

/** positions: only players that moved, at most every MOVES_BROADCAST_MS, each room separately */
setInterval(() => {
  for (const [roomKey, moves] of takeMovesByRoom()) {
    io.to(socketRoomOf(roomKey)).emit("lounge:moves", { moves });
  }
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

  /** lounge room from the verified ticket (backend checked membership). Dev guests are always in the square. */
  const roomKey = identity ? normalizeRoomKey(identity.room) : SQUARE_ROOM;
  const roomName = socketRoomOf(roomKey);
  const roomLabel = identity ? cleanText(identity.rname, 40) ?? "광장" : "광장";

  const joined = () => socket.rooms.has(roomName) && Boolean(getPlayer(socket.id));

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
    const player = addPlayer(socket.id, roomKey, profile, extrasFromPayload(payload));
    socket.join(roomName);
    console.log(`[lounge] join ${player.id} room=${roomKey} level=${player.level} tier=${player.tier}`);
    broadcastPlayers(roomKey);
    socket.emit("lounge:welcome", { mapSize, room: roomKey, roomName: roomLabel });
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
      // who said it — the plaza shows a speech bubble over that player
      fromSocketId: socket.id,
      nickname: nicknameOf(socket),
      message,
      ts: new Date().toISOString(),
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

  on("ping:check", "ping", (payload: PingPayload) => {
    if (!payload || !Number.isFinite(payload.clientTs)) return;
    socket.emit("ping:result", { clientTs: payload.clientTs, serverTs: Date.now() });
  });

  socket.on("disconnect", () => {
    const leftRoom = removePlayer(socket.id);
    if (leftRoom) broadcastPlayers(leftRoom);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[lounge] realtime server listening on ${PORT} (auth: ${authMode})`);
});
