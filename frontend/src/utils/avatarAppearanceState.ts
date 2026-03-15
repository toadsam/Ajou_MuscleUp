import type { AvatarCustomization } from "./avatarCustomization";
import type { EvolutionBranch } from "./evolutionProgress";

export type AvatarAppearanceState = {
  branch?: EvolutionBranch | null;
  activeSkillIds?: string[];
  customization?: AvatarCustomization;
};

const keyBySeed = (seed: string) => `avatar-appearance-v1:${seed}`;

export const loadAppearanceBySeed = (seed: string): AvatarAppearanceState | null => {
  if (!seed) return null;
  try {
    const raw = localStorage.getItem(keyBySeed(seed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AvatarAppearanceState;
    return {
      branch: parsed.branch ?? null,
      activeSkillIds: Array.isArray(parsed.activeSkillIds) ? parsed.activeSkillIds.filter((v) => typeof v === "string") : [],
      customization: parsed.customization ?? {},
    };
  } catch {
    return null;
  }
};

export const saveAppearanceBySeed = (seed: string, state: AvatarAppearanceState) => {
  if (!seed) return;
  localStorage.setItem(keyBySeed(seed), JSON.stringify(state));
};
