import { createServer } from "http";
import { Server } from "socket.io";
import {
  addPlayer,
  getMapSize,
  getRoomName,
  listPlayers,
  removePlayer,
  updatePlayerPosition,
} from "./rooms.js";
import type { CharacterTier, Gender, JoinPayload, PingPayload, TypingPayload } from "./types.js";

const PORT = Number(process.env.PORT ?? 4001);
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
const ALLOWED_ORIGINS = ORIGIN.split(",").map((origin) => origin.trim());

const roomName = getRoomName();
const mapSize = getMapSize();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

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

const isValidTier = (tier: any): tier is CharacterTier =>
  typeof tier === "string" && TIER_VALUES.includes(tier as CharacterTier);

const isValidGender = (gender: any): gender is Gender =>
  typeof gender === "string" && GENDER_VALUES.includes(gender as Gender);

const sanitizeNickname = (nickname: string) => nickname.trim().slice(0, 30);

const isValidJoinPayload = (payload: any): payload is JoinPayload => {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.nickname !== "string") return false;
  const nickname = sanitizeNickname(payload.nickname);
  if (!nickname) return false;
  if (!Number.isFinite(payload.level) || payload.level < 1) return false;
  if (!Number.isFinite(payload.evolutionStage) || payload.evolutionStage < 0) return false;
  if (!isValidTier(payload.tier)) return false;
  if (payload.gender && !isValidGender(payload.gender)) return false;
  if (
    payload.recentAttendanceCount !== undefined &&
    (!Number.isFinite(payload.recentAttendanceCount) || payload.recentAttendanceCount < 0)
  ) {
    return false;
  }
  if (payload.activeEventTitle && typeof payload.activeEventTitle !== "string") {
    return false;
  }
  if (payload.activeEventProgress && typeof payload.activeEventProgress !== "string") {
    return false;
  }
  return true;
};

const broadcastPlayers = () => {
  io.to(roomName).emit("lounge:players", { players: listPlayers() });
};

let pendingBroadcast = false;
setInterval(() => {
  if (!pendingBroadcast) return;
  pendingBroadcast = false;
  broadcastPlayers();
}, 60);

const scheduleBroadcast = () => {
  pendingBroadcast = true;
};

io.on("connection", (socket) => {
  console.log(`[lounge] connected ${socket.id}`);

  socket.on("lounge:join", (payload) => {
    // TODO: Verify JWT/access token in realtime server (MVP skips).
    if (!isValidJoinPayload(payload)) {
      socket.emit("lounge:error", { message: "Invalid join payload." });
      socket.disconnect(true);
      return;
    }

    const nickname = sanitizeNickname(payload.nickname);
    const player = addPlayer(socket.id, { ...payload, nickname });
    socket.data.profile = player;
    socket.join(roomName);

    console.log(
      `[lounge] join nickname=${player.nickname} level=${player.level} tier=${player.tier}`
    );
    broadcastPlayers();
    socket.emit("lounge:welcome", { mapSize });
  });

  socket.on("player:move", (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    const updated = updatePlayerPosition(socket.id, payload.x, payload.y);
    if (!updated) return;
    scheduleBroadcast();
  });

  socket.on("chat:send", (payload) => {
    if (!payload || typeof payload.message !== "string") return;
    const message = payload.message.trim();
    if (!message || message.length > 200) return;
    const nickname =
      (socket.data.profile && socket.data.profile.nickname) || "Unknown";
    console.log(`[lounge] chat ${nickname}: ${message}`);
    io.to(roomName).emit("chat:message", {
      nickname,
      message,
      ts: new Date().toISOString(),
    });
  });

  socket.on("chat:typing", (payload: TypingPayload) => {
    if (!payload || typeof payload.isTyping !== "boolean") return;
    const nickname =
      (socket.data.profile && socket.data.profile.nickname) || "Unknown";
    socket.to(roomName).emit("chat:typing", {
      nickname,
      isTyping: payload.isTyping,
    });
  });

  socket.on("ping:check", (payload: PingPayload) => {
    if (!payload || !Number.isFinite(payload.clientTs)) return;
    socket.emit("ping:result", { clientTs: payload.clientTs, serverTs: Date.now() });
  });

  socket.on("disconnect", () => {
    removePlayer(socket.id);
    broadcastPlayers();
    console.log(`[lounge] disconnected ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[lounge] realtime server listening on ${PORT}`);
});
