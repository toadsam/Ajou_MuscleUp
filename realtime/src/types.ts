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

export const GROWTH_PARAM_KEYS: (keyof GrowthParams)[] = [
  "bmiNormalized",
  "muscularityNormalized",
  "fatNormalized",
  "armGrowth",
  "legGrowth",
  "torsoGrowth",
  "armScale",
  "legScale",
  "torsoScaleX",
  "chestGrowth",
  "backGrowth",
  "shoulderGrowth",
  "quadGrowth",
  "hamstringGrowth",
  "gluteGrowth",
  "strokeWidth",
  "muscleDetailOpacity",
  "fatShadowOpacity",
  "contrastBoost",
];

/** What every lounge client sees about a player. No email / DB user id. */
export type PlayerState = {
  socketId: string;
  /** opaque public id (HMAC of user id) or "guest-..." in dev mode */
  id: string;
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
  /** 운동 직후 펌핑 중 · 장착한 민소매 색 · 칭호 (입장권에서만) */
  isPumped?: boolean;
  tank?: string;
  title?: string;
  recentAttendanceCount?: number;
  activeEventTitle?: string;
  activeEventProgress?: string;
  x: number;
  y: number;
  lastUpdatedAt: string;
};

/** Profile fields decided by the server (from the verified ticket). */
export type VerifiedProfile = Pick<
  PlayerState,
  | "id"
  | "nickname"
  | "level"
  | "tier"
  | "evolutionStage"
  | "gender"
  | "avatarSeed"
  | "stylePreset"
  | "isResting"
  | "growthParams"
  | "isPumped"
  | "tank"
  | "title"
>;

/** Self-described, cosmetic fields the client may still send (validated + length-limited). */
export type ClientExtras = Pick<
  PlayerState,
  "mbti" | "recentAttendanceCount" | "activeEventTitle" | "activeEventProgress"
>;

export type TypingPayload = {
  isTyping: boolean;
};

export type PingPayload = {
  clientTs: number;
};
