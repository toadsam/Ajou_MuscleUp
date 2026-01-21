import type { JoinPayload, PlayerState } from "./types.js";

const ROOM_NAME = "lounge";
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;

const players = new Map<string, PlayerState>();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nowIso = () => new Date().toISOString();

const randomPosition = () => ({
  x: Math.random() * (MAP_WIDTH - 80) + 40,
  y: Math.random() * (MAP_HEIGHT - 80) + 40,
});

export const getRoomName = () => ROOM_NAME;

export const getMapSize = () => ({ width: MAP_WIDTH, height: MAP_HEIGHT });

export const addPlayer = (socketId: string, payload: JoinPayload) => {
  const { x, y } = randomPosition();
  const player: PlayerState = {
    socketId,
    userId: payload.userId,
    nickname: payload.nickname,
    level: payload.level,
    tier: payload.tier,
    evolutionStage: payload.evolutionStage,
    x,
    y,
    lastUpdatedAt: nowIso(),
  };
  players.set(socketId, player);
  return player;
};

export const updatePlayerPosition = (socketId: string, x: number, y: number) => {
  const player = players.get(socketId);
  if (!player) return null;
  player.x = clamp(x, 0, MAP_WIDTH);
  player.y = clamp(y, 0, MAP_HEIGHT);
  player.lastUpdatedAt = nowIso();
  return player;
};

export const removePlayer = (socketId: string) => {
  players.delete(socketId);
};

export const listPlayers = () => Array.from(players.values());
