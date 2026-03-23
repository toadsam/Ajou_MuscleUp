import type { AvatarCustomization } from "./avatarCustomization";
import type { EvolutionBranch } from "./evolutionProgress";

export type AvatarAppearanceState = {
  branch?: EvolutionBranch | null;
  activeSkillIds?: string[];
  customization?: AvatarCustomization;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
};

const keyBySeed = (seed: string) => `avatar-appearance-v1:${seed}`;
export const AVATAR_APPEARANCE_EVENT = "avatar-appearance-updated";

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
      gender: parsed.gender === "FEMALE" ? "FEMALE" : parsed.gender === "MALE" ? "MALE" : null,
      isResting: typeof parsed.isResting === "boolean" ? parsed.isResting : false,
    };
  } catch {
    return null;
  }
};

export const saveAppearanceBySeed = (seed: string, state: AvatarAppearanceState) => {
  if (!seed) return;
  localStorage.setItem(keyBySeed(seed), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(AVATAR_APPEARANCE_EVENT, { detail: { seed, state } }));
};
