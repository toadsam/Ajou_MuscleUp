import type { StageCharacter } from "../workout/LiftStage";

// 전투 연출이 같이 쓰는 숫자 · 셈(BossFight 1차 · DungeonStage 2차). 그림 부품은 ImpactMark.tsx.

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** AvatarRenderer 와 같은 셈으로 내 근육 단계를 구해 그림자도 같은 덩치로 */
export function buildOf(character: StageCharacter | null): 0 | 1 | 2 | 3 {
  const g = character?.growthParams;
  if (!g) return 1;
  const score = clamp01(g.muscularityNormalized) * 2.4 + clamp01(g.shoulderGrowth) * 0.6;
  return Math.max(0, Math.min(3, Math.floor(score + 0.3))) as 0 | 1 | 2 | 3;
}

/** 처치 때 조각이 날아가는 방향(원판 색 순서대로) */
export const SHARDS = [
  { dx: -58, dy: -44, rot: -140, color: "#D9302A", s: 14 },
  { dx: 52, dy: -56, rot: 160, color: "#2F6FD0", s: 12 },
  { dx: -36, dy: 14, rot: -70, color: "#F0BE2E", s: 10 },
  { dx: 44, dy: 10, rot: 100, color: "#2E9C55", s: 12 },
  { dx: -14, dy: -70, rot: 50, color: "#9A9DA3", s: 8 },
  { dx: 20, dy: 24, rot: -220, color: "#D9302A", s: 10 },
  { dx: -70, dy: -10, rot: 80, color: "#2F6FD0", s: 8 },
  { dx: 66, dy: -22, rot: -110, color: "#F0BE2E", s: 8 },
  { dx: 6, dy: -40, rot: 200, color: "#EEECE6", s: 6 },
  { dx: -24, dy: -24, rot: -30, color: "#EEECE6", s: 6 },
];

/** total 을 n 조각으로(앞은 작게, 마지막이 가장 크게). 합은 정확히 total */
export function splitShares(total: number, n: number) {
  if (n <= 1) return [total];
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    const share = i === n - 1 ? total - acc : Math.floor((total * (i + 1)) / ((n * (n + 1)) / 2));
    out.push(share);
    acc += share;
  }
  return out;
}

export const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};
