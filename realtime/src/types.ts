export type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export type Gender = "MALE" | "FEMALE";

export type PlayerState = {
  socketId: string;
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  gender?: Gender;
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
  gender?: Gender;
};

export type TypingPayload = {
  isTyping: boolean;
};

export type PingPayload = {
  clientTs: number;
};
