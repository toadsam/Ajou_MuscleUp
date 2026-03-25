import type { CharacterTier, GrowthParams } from "../components/avatar/types";

export type EvolutionBranch = "TITAN" | "BLAZE" | "PHANTOM";

export type SkillUnlock = {
  id: string;
  name: string;
  requirement: string;
  unlocked: boolean;
  effect: string;
};

type BranchInput = {
  strengthRatio?: number;
  threeLiftTotal?: number;
  muscularity?: number;
  bodyFat?: number;
};

const tierStep = (tier: CharacterTier) =>
  ({
    BRONZE: 0,
    SILVER: 1,
    GOLD: 2,
    PLATINUM: 3,
    DIAMOND: 4,
    MASTER: 5,
    GRANDMASTER: 6,
    CHALLENGER: 7,
  } as const)[tier];

export const resolveEvolutionBranch = (input: BranchInput): EvolutionBranch => {
  const strength = input.strengthRatio ?? 0;
  const lift = input.threeLiftTotal ?? 0;
  const muscularity = input.muscularity ?? 0;
  const fat = input.bodyFat ?? 0;

  const titan = strength * 1.1 + lift * 0.005 + muscularity * 0.8 - fat * 0.12;
  const blaze = strength * 0.95 + muscularity * 0.95 + (1 - fat) * 0.78;
  const phantom = (1 - fat) * 1.05 + strength * 0.44;

  if (titan >= blaze && titan >= phantom) return "TITAN";
  if (phantom > blaze) return "PHANTOM";
  return "BLAZE";
};

export const resolveSkillUnlocks = (params: {
  level: number;
  stage: number;
  tier: CharacterTier;
  attendanceCount: number;
  branch: EvolutionBranch;
}): SkillUnlock[] => {
  const step = tierStep(params.tier);
  const branchSkill =
    params.branch === "TITAN" ? "타이탄 가드" : params.branch === "PHANTOM" ? "팬텀 플로우" : "블레이즈 템포";

  return [
    { id: "aura", name: "오라 점화", requirement: "레벨 8", unlocked: params.level >= 8, effect: "오라 링과 글로우가 강화됩니다." },
    { id: "wave", name: "충격파", requirement: "스테이지 3", unlocked: params.stage >= 3, effect: "주기적인 웨이브 이펙트가 활성화됩니다." },
    { id: "branch", name: branchSkill, requirement: "티어 GOLD", unlocked: step >= 2, effect: "분기 전용 시그니처 마크가 활성화됩니다." },
    { id: "burst", name: "오버드라이브", requirement: "출석 10회", unlocked: params.attendanceCount >= 10, effect: "입자 폭발과 에너지 링이 추가됩니다." },
  ];
};

export const branchTheme = (branch: EvolutionBranch) => {
  if (branch === "TITAN") return { accent: "#fb923c", archetype: "guardian" as const };
  if (branch === "PHANTOM") return { accent: "#67e8f9", archetype: "strategist" as const };
  return { accent: "#f472b6", archetype: "adventurer" as const };
};

export const amplifyGrowthParams = (
  base: GrowthParams,
  branch: EvolutionBranch,
  unlockedSkillCount: number
): GrowthParams => {
  const branchBoost = branch === "TITAN" ? 1.15 : branch === "BLAZE" ? 1.12 : 1.1;
  const skillBoost = 1 + unlockedSkillCount * 0.05;
  const k = branchBoost * skillBoost;

  return {
    ...base,
    armGrowth: base.armGrowth * (1.1 * k),
    legGrowth: base.legGrowth * (1.1 * k),
    torsoGrowth: base.torsoGrowth * (1.12 * k),
    chestGrowth: base.chestGrowth * (1.14 * k),
    backGrowth: base.backGrowth * (1.14 * k),
    shoulderGrowth: base.shoulderGrowth * (1.16 * k),
    quadGrowth: base.quadGrowth * (1.12 * k),
    hamstringGrowth: base.hamstringGrowth * (1.1 * k),
    gluteGrowth: base.gluteGrowth * (1.08 * k),
    armScale: Math.min(1.5, base.armScale + 0.03 + unlockedSkillCount * 0.015),
    legScale: Math.min(1.5, base.legScale + 0.03 + unlockedSkillCount * 0.015),
    torsoScaleX: Math.min(1.45, base.torsoScaleX + 0.02 + unlockedSkillCount * 0.012),
    strokeWidth: Math.min(4.8, base.strokeWidth + 0.35 + unlockedSkillCount * 0.08),
    muscleDetailOpacity: Math.min(1, base.muscleDetailOpacity + 0.14 + unlockedSkillCount * 0.04),
    contrastBoost: Math.min(1.5, base.contrastBoost + 0.06 + unlockedSkillCount * 0.03),
  };
};
