import type { AvatarCustomization } from "./avatarCustomization";
import type { EvolutionBranch } from "./evolutionProgress";

export type AvatarAppearanceState = {
  branch?: EvolutionBranch | null;
  activeSkillIds?: string[];
  customization?: AvatarCustomization;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
  attendanceRisk?: "normal" | "warning" | "critical";
  /** 도감에서 장착한 민소매 색(#RRGGBB) — 없으면 기본 색 */
  tank?: string | null;
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
      attendanceRisk:
        parsed.attendanceRisk === "critical"
          ? "critical"
          : parsed.attendanceRisk === "warning"
            ? "warning"
            : "normal",
      tank: typeof parsed.tank === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.tank) ? parsed.tank : null,
    };
  } catch {
    return null;
  }
};

export const saveAppearanceBySeed = (seed: string, state: AvatarAppearanceState) => {
  if (!seed) return;
  // 민소매 색(도감)은 다른 화면이 tank 없이 저장해도 지우지 않는다
  const next = state.tank === undefined ? { ...state, tank: loadAppearanceBySeed(seed)?.tank ?? null } : state;
  localStorage.setItem(keyBySeed(seed), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(AVATAR_APPEARANCE_EVENT, { detail: { seed, state: next } }));
};
