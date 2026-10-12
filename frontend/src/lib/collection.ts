// 도감(모으는 재미) + 보상 상자. 서버: /api/collection.
// 장착한 민소매 색은 이 기기의 아바타 꾸미기 상태(avatarAppearanceState)에 넣어, 내 아바타가 그려지는 곳 어디서나 보이게 한다.
import { loadAppearanceBySeed, saveAppearanceBySeed } from "../utils/avatarAppearanceState";
import type { ActivityLevel } from "./quests";

export type CollectionCategory = "TITLE" | "TANK" | "FRAME";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type CollectionItemView = {
  code: string;
  category: CollectionCategory;
  rarity: Rarity;
  label: string;
  value: string;
  fromBox: boolean;
  hint: string;
  progress: number | null;
  goal: number | null;
  owned: boolean;
  isNew: boolean;
  acquiredAt: string | null;
  craftCost: number | null;
};

export type Equipped = {
  titleCode: string | null;
  title: string | null;
  tankCode: string | null;
  tank: string | null;
  frameCode: string | null;
  frame: string | null;
};

export type CollectionView = {
  boxes: number;
  shards: number;
  boxesOpened: number;
  owned: number;
  total: number;
  equipped: Equipped;
  activity: ActivityLevel;
  items: CollectionItemView[];
  newlyUnlocked: string[];
  welcomeBox: boolean;
};

export type CollectionSummary = {
  boxes: number;
  owned: number;
  total: number;
  equipped: Equipped;
  activity: ActivityLevel;
};

export type OpenResult = {
  item: CollectionItemView;
  duplicate: boolean;
  shardsGained: number;
  boxes: number;
  shards: number;
};

export const COLLECTION_PATH = "/api/collection";
export const COLLECTION_SUMMARY_PATH = "/api/collection/summary";

export const CATEGORY_LABEL: Record<CollectionCategory, string> = {
  TITLE: "칭호",
  TANK: "민소매 색",
  FRAME: "카드 테두리",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "보통",
  RARE: "희귀",
  EPIC: "영웅",
  LEGENDARY: "전설",
};

/** 등급 색 — 원판 색 의미를 따른다: 보통 철판 · 희귀 파랑 · 영웅 빨강 · 전설 노랑 */
export const RARITY_CLASS: Record<Rarity, { text: string; border: string; bg: string }> = {
  COMMON: { text: "text-steel-300", border: "border-steel-500", bg: "bg-steel-600" },
  RARE: { text: "text-plate-blue", border: "border-plate-blue", bg: "bg-plate-blue" },
  EPIC: { text: "text-plate-red", border: "border-plate-red", bg: "bg-plate-red" },
  LEGENDARY: { text: "text-plate-yellow", border: "border-plate-yellow", bg: "bg-plate-yellow" },
};

/** 카드 테두리 값 → CSS 클래스(index.css 의 .dg-frame-*) */
export const frameClass = (frame: string | null | undefined) => (frame ? `dg-frame dg-frame-${frame}` : "");

export const BOX_REASON: Record<string, string> = {
  WEEKLY_GOAL: "주간 목표 달성 보상 상자",
  LUCKY: "행운의 보상 상자",
};

/** 장착한 민소매 색을 내 아바타(이 기기)에 반영 — 같으면 건드리지 않는다 */
export function syncEquippedTank(seed: string | null | undefined, tank: string | null) {
  if (!seed) return;
  const current = loadAppearanceBySeed(seed);
  if ((current?.tank ?? null) === tank) return;
  try {
    saveAppearanceBySeed(seed, { ...(current ?? {}), tank });
  } catch {
    // 저장소를 못 쓰면 기본 색 그대로
  }
}
