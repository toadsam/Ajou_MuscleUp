export type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export type Mbti =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

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

export type AvatarSeed = string;

export const defaultGrowthParams: GrowthParams = {
  bmiNormalized: 0,
  muscularityNormalized: 0,
  fatNormalized: 0,
  armGrowth: 0,
  legGrowth: 0,
  torsoGrowth: 0,
  armScale: 1,
  legScale: 1,
  torsoScaleX: 1,
  chestGrowth: 0,
  backGrowth: 0,
  shoulderGrowth: 0,
  quadGrowth: 0,
  hamstringGrowth: 0,
  gluteGrowth: 0,
  strokeWidth: 2,
  muscleDetailOpacity: 0,
  fatShadowOpacity: 0,
  contrastBoost: 1,
};
