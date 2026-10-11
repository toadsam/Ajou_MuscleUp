import type { ClientExtras, PlayerState, VerifiedProfile } from "./types.js";

const ROOM_NAME = "lounge";
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 1200;

const players = new Map<string, PlayerState>();
/** socket ids whose position changed since the last moves broadcast */
const dirty = new Set<string>();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nowIso = () => new Date().toISOString();

const randomPosition = () => ({
  x: Math.random() * (MAP_WIDTH - 80) + 40,
  y: Math.random() * (MAP_HEIGHT - 80) + 40,
});

export const getRoomName = () => ROOM_NAME;

export const getMapSize = () => ({ width: MAP_WIDTH, height: MAP_HEIGHT });

export const addPlayer = (socketId: string, profile: VerifiedProfile, extras: ClientExtras) => {
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
  return player;
};

export const getPlayer = (socketId: string) => players.get(socketId);

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

/** changed positions since the last call: [{ socketId, x, y }] */
export const takeMoves = () => {
  if (dirty.size === 0) return [];
  const moves: { socketId: string; x: number; y: number }[] = [];
  for (const socketId of dirty) {
    const player = players.get(socketId);
    if (player) moves.push({ socketId, x: player.x, y: player.y });
  }
  dirty.clear();
  return moves;
};

export const removePlayer = (socketId: string) => {
  dirty.delete(socketId);
  return players.delete(socketId);
};

export const listPlayers = () => Array.from(players.values());
