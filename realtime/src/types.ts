export type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export type PlayerState = {
  socketId: string;
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  x: number;
  y: number;
  lastUpdatedAt: string;
};

export type JoinPayload = {
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
};
