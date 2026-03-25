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

export type GrowthParams = {
  bmiNormalized: number;
  muscularityNormalized: number;
  fatNormalized: number;
  armGrowth: number;
  legGrowth: number;
  torsoGrowth: number;
  armScale: number;
  legScale: number;
  torsoScaleX: number;
  chestGrowth: number;
  backGrowth: number;
  shoulderGrowth: number;
  quadGrowth: number;
  hamstringGrowth: number;
  gluteGrowth: number;
  strokeWidth: number;
  muscleDetailOpacity: number;
  fatShadowOpacity: number;
  contrastBoost: number;
};

export type PlayerState = {
  socketId: string;
  userId?: string;
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  gender?: Gender;
  avatarSeed?: string;
  stylePreset?: string;
  mbti?: string;
  isResting?: boolean;
  growthParams?: GrowthParams;
  recentAttendanceCount?: number;
  activeEventTitle?: string;
  activeEventProgress?: string;
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
  avatarSeed?: string;
  stylePreset?: string;
  mbti?: string;
  isResting?: boolean;
  growthParams?: GrowthParams;
  recentAttendanceCount?: number;
  activeEventTitle?: string;
  activeEventProgress?: string;
};

export type TypingPayload = {
  isTyping: boolean;
};

export type PingPayload = {
  clientTs: number;
};
