import { createServer } from "http";
import { Server } from "socket.io";
import { addPlayer, getMapSize, getRoomName, listPlayers, removePlayer, updatePlayerPosition, } from "./rooms.js";
const PORT = Number(process.env.PORT ?? 4001);
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
const ALLOWED_ORIGINS = ORIGIN.split(",").map((origin) => origin.trim());
const roomName = getRoomName();
const mapSize = getMapSize();
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
});
const TIER_VALUES = [
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "DIAMOND",
    "MASTER",
    "GRANDMASTER",
    "CHALLENGER",
];
const GENDER_VALUES = ["MALE", "FEMALE"];
const isValidTier = (tier) => typeof tier === "string" && TIER_VALUES.includes(tier);
const isValidGender = (gender) => typeof gender === "string" && GENDER_VALUES.includes(gender);
const sanitizeNickname = (nickname) => nickname.trim().slice(0, 30);
const isValidJoinPayload = (payload) => {
    if (!payload || typeof payload !== "object")
        return false;
    if (typeof payload.nickname !== "string")
        return false;
    const nickname = sanitizeNickname(payload.nickname);
    if (!nickname)
        return false;
    if (!Number.isFinite(payload.level) || payload.level < 1)
        return false;
    if (!Number.isFinite(payload.evolutionStage) || payload.evolutionStage < 0)
        return false;
    if (!isValidTier(payload.tier))
        return false;
    if (payload.gender && !isValidGender(payload.gender))
        return false;
    if (payload.avatarSeed !== undefined && typeof payload.avatarSeed !== "string")
        return false;
    if (payload.stylePreset !== undefined && typeof payload.stylePreset !== "string")
        return false;
    if (payload.mbti !== undefined && typeof payload.mbti !== "string")
        return false;
    if (payload.growthParams !== undefined && typeof payload.growthParams !== "object")
        return false;
    if (payload.recentAttendanceCount !== undefined &&
        (!Number.isFinite(payload.recentAttendanceCount) || payload.recentAttendanceCount < 0)) {
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
    if (!pendingBroadcast)
        return;
    pendingBroadcast = false;
    broadcastPlayers();
}, 60);
const scheduleBroadcast = () => {
    pendingBroadcast = true;
};
io.on("connection", (socket) => {
    console.log(`[lounge] connected ${socket.id}`);
    const getFriendRoom = (a, b) => {
        const [low, high] = [a.trim().toLowerCase(), b.trim().toLowerCase()].sort();
        return `friend:${low}:${high}`;
    };
    socket.on("friend:join", (payload) => {
        if (!payload || typeof payload.userId !== "string")
            return;
        const userId = payload.userId.trim().toLowerCase();
        if (!userId)
            return;
        socket.data.friendUserId = userId;
    });
    socket.on("friend:subscribe", (payload) => {
        const myId = socket.data.friendUserId;
        if (!myId || typeof myId !== "string")
            return;
        if (!payload || typeof payload.peerId !== "string")
            return;
        const peerId = payload.peerId.trim().toLowerCase();
        if (!peerId)
            return;
        socket.join(getFriendRoom(myId, peerId));
    });
    socket.on("friend:send", (payload) => {
        const myId = socket.data.friendUserId;
        if (!myId || typeof myId !== "string")
            return;
        if (!payload || typeof payload.peerId !== "string")
            return;
        const peerId = payload.peerId.trim().toLowerCase();
        if (!peerId)
            return;
        const message = payload.message;
        if (!message || typeof message !== "object")
            return;
        io.to(getFriendRoom(myId, peerId)).emit("friend:message", {
            from: myId,
            to: peerId,
            message,
        });
    });
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
        console.log(`[lounge] join nickname=${player.nickname} level=${player.level} tier=${player.tier}`);
        broadcastPlayers();
        socket.emit("lounge:welcome", { mapSize });
    });
    socket.on("player:move", (payload) => {
        if (!payload || typeof payload !== "object")
            return;
        if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y))
            return;
        const updated = updatePlayerPosition(socket.id, payload.x, payload.y);
        if (!updated)
            return;
        scheduleBroadcast();
    });
    socket.on("chat:send", (payload) => {
        if (!payload || typeof payload.message !== "string")
            return;
        const message = payload.message.trim();
        if (!message || message.length > 200)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        console.log(`[lounge] chat ${nickname}: ${message}`);
        io.to(roomName).emit("chat:message", {
            nickname,
            message,
            ts: new Date().toISOString(),
        });
    });
    socket.on("chat:typing", (payload) => {
        if (!payload || typeof payload.isTyping !== "boolean")
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        socket.to(roomName).emit("chat:typing", {
            nickname,
            isTyping: payload.isTyping,
        });
    });
    socket.on("social:emote", (payload) => {
        if (!payload || typeof payload.emote !== "string")
            return;
        const emote = payload.emote.trim().slice(0, 40);
        if (!emote)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        io.to(roomName).emit("social:emote", {
            fromSocketId: socket.id,
            nickname,
            emote,
            ts: Date.now(),
        });
    });
    socket.on("social:sticker", (payload) => {
        if (!payload || typeof payload.sticker !== "string")
            return;
        const sticker = payload.sticker.trim().slice(0, 40);
        if (!sticker)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        io.to(roomName).emit("social:sticker", {
            fromSocketId: socket.id,
            nickname,
            sticker,
            ts: Date.now(),
        });
    });
    socket.on("voice:chunk", (payload) => {
        if (!payload || typeof payload.audioBase64 !== "string")
            return;
        if (payload.audioBase64.length > 180_000)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        socket.to(roomName).emit("voice:chunk", {
            fromSocketId: socket.id,
            nickname,
            audioBase64: payload.audioBase64,
            mimeType: typeof payload.mimeType === "string" ? payload.mimeType.slice(0, 50) : "audio/webm",
            ts: Date.now(),
        });
    });
    socket.on("party:follow-request", (payload) => {
        if (!payload || typeof payload.toSocketId !== "string")
            return;
        const toSocketId = payload.toSocketId.trim();
        if (!toSocketId)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        io.to(toSocketId).emit("party:follow-request", {
            fromSocketId: socket.id,
            nickname,
            ts: Date.now(),
        });
    });
    socket.on("party:follow-response", (payload) => {
        if (!payload || typeof payload.toSocketId !== "string")
            return;
        const toSocketId = payload.toSocketId.trim();
        if (!toSocketId)
            return;
        io.to(toSocketId).emit("party:follow-response", {
            fromSocketId: socket.id,
            accepted: Boolean(payload.accepted),
            ts: Date.now(),
        });
    });
    socket.on("party:teleport-request", (payload) => {
        if (!payload || typeof payload.toSocketId !== "string")
            return;
        const toSocketId = payload.toSocketId.trim();
        if (!toSocketId)
            return;
        const nickname = (socket.data.profile && socket.data.profile.nickname) || "Unknown";
        io.to(toSocketId).emit("party:teleport-request", {
            fromSocketId: socket.id,
            nickname,
            ts: Date.now(),
        });
    });
    socket.on("party:teleport-response", (payload) => {
        if (!payload || typeof payload.toSocketId !== "string")
            return;
        const toSocketId = payload.toSocketId.trim();
        if (!toSocketId)
            return;
        const x = Number(payload.x);
        const y = Number(payload.y);
        io.to(toSocketId).emit("party:teleport-response", {
            fromSocketId: socket.id,
            accepted: Boolean(payload.accepted),
            x: Number.isFinite(x) ? x : undefined,
            y: Number.isFinite(y) ? y : undefined,
            ts: Date.now(),
        });
    });
    socket.on("ping:check", (payload) => {
        if (!payload || !Number.isFinite(payload.clientTs))
            return;
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
