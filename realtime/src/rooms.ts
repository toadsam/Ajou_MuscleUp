import type { ClientExtras, PlayerState, VerifiedProfile } from "./types.js";

/**
 * Lounge rooms (stage 0 PR 7): "square" (everyone) and "gym:{id}" (members of one gym).
 * The room key comes only from the verified ticket (backend checks membership); clients cannot pick it.
 * Every player is in exactly one room. Lists, moves, chat and emotes stay inside the room.
 */
export const SQUARE_ROOM = "square";
const ROOM_KEY_PATTERN = /^(square|gym:\d{1,18})$/;

// The client "deukgeun plaza" is 28 x 40 tiles of 16px (frontend/src/components/lounge/plaza.ts).
const MAP_WIDTH = 448;
const MAP_HEIGHT = 640;

const players = new Map<string, PlayerState>();
/** socket id -> room key */
const roomOfSocket = new Map<string, string>();
/** socket ids whose position changed since the last moves broadcast */
const dirty = new Set<string>();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nowIso = () => new Date().toISOString();

// New players appear just inside the south gate (tiles 12..15, row 35); the client then sends its own position.
const randomPosition = () => ({
  x: Math.round(12 * 16 + 8 + Math.random() * 48),
  y: 35 * 16 + 12,
});

/** unknown / malformed keys fall back to the square */
export const normalizeRoomKey = (value: unknown) =>
  typeof value === "string" && ROOM_KEY_PATTERN.test(value) ? value : SQUARE_ROOM;

/** socket.io room name for a lounge room key */
export const socketRoomOf = (roomKey: string) => `lounge:${roomKey}`;

export const getMapSize = () => ({ width: MAP_WIDTH, height: MAP_HEIGHT });

export const addPlayer = (socketId: string, roomKey: string, profile: VerifiedProfile, extras: ClientExtras) => {
  const existing = players.get(socketId);
  const { x, y } = existing ?? randomPosition();
  const player: PlayerState = {
    socketId,
    ...profile,
    ...extras,
    x,
    y,
    lastUpdatedAt: nowIso(),
  };
  players.set(socketId, player);
  roomOfSocket.set(socketId, roomKey);
  return player;
};

export const getPlayer = (socketId: string) => players.get(socketId);

export const getRoomOf = (socketId: string) => roomOfSocket.get(socketId);

export const updatePlayerPosition = (socketId: string, x: number, y: number) => {
  const player = players.get(socketId);
  if (!player) return null;
  const nextX = Math.round(clamp(x, 0, MAP_WIDTH) * 10) / 10;
  const nextY = Math.round(clamp(y, 0, MAP_HEIGHT) * 10) / 10;
  if (nextX === player.x && nextY === player.y) return null;
  player.x = nextX;
  player.y = nextY;
  player.lastUpdatedAt = nowIso();
  dirty.add(socketId);
  return player;
};

/** changed positions since the last call, grouped by room: Map(roomKey -> [{ socketId, x, y }]) */
export const takeMovesByRoom = () => {
  const byRoom = new Map<string, { socketId: string; x: number; y: number }[]>();
  if (dirty.size === 0) return byRoom;
  for (const socketId of dirty) {
    const player = players.get(socketId);
    const roomKey = roomOfSocket.get(socketId);
    if (!player || !roomKey) continue;
    const list = byRoom.get(roomKey) ?? [];
    list.push({ socketId, x: player.x, y: player.y });
    byRoom.set(roomKey, list);
  }
  dirty.clear();
  return byRoom;
};

/** removes the player; returns the room it was in (or undefined) */
export const removePlayer = (socketId: string) => {
  dirty.delete(socketId);
  const roomKey = roomOfSocket.get(socketId);
  roomOfSocket.delete(socketId);
  return players.delete(socketId) ? roomKey : undefined;
};

export const listPlayers = (roomKey: string) =>
  Array.from(players.values()).filter((p) => roomOfSocket.get(p.socketId) === roomKey);

export const countPlayers = (roomKey?: string) => {
  if (!roomKey) return players.size;
  let n = 0;
  for (const key of roomOfSocket.values()) if (key === roomKey) n += 1;
  return n;
};
