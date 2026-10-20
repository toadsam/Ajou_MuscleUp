// 작은 그림(홈 지도 · 라운지 광장 · 던전 지도의 10×16 사람)의 사람마다 다른 모양.
// 큰 카드 그림(AvatarRenderer → chibiArt)과 같은 값 · 같은 규칙으로 정해서, 어디서 봐도 같은 캐릭터로 보이게 한다(2026-10-20).
//   머리 모양: 시드(resolveSeedFeatures().hairStyle) % 4 · 여자: gender FEMALE · 몸 단계: 서버 bodyStage(없으면 근육량 · 진화 단계로 짐작) + 펌핑 1
//   머리띠: 티어 다이아(4) 이상, 색은 민소매가 빨강이면 파랑 · 아니면 빨강
import type { SpriteShape } from "../gymMap/engine";
import { bodyStageOf, headbandFor, tierStepOf } from "./chibiArt";
import { resolveSeedFeatures } from "./seed";

export type LookInput = {
  avatarSeed?: string | null;
  gender?: string | null;
  /** 서버 BodyStage 0~5 */
  bodyStage?: number | null;
  evolutionStage?: number | null;
  growthParams?: { muscularityNormalized?: number | null } | null;
  tier?: string | null;
  /** 운동 직후 펌핑(몸 단계 +1) */
  pumped?: boolean | null;
};

/** 카드 그림과 같은 몸 단계(0~5) */
export function bodyStageFor(c: LookInput): number {
  const known = c.bodyStage !== null && c.bodyStage !== undefined && Number.isFinite(c.bodyStage);
  const base = known
    ? Math.max(0, Math.min(5, Math.round(c.bodyStage as number)))
    : bodyStageOf({ muscularity: c.growthParams?.muscularityNormalized ?? 0, level: Math.max(1, c.evolutionStage ?? 1) * 10 + 1, activityLevel: 0 });
  return Math.min(5, base + (c.pumped ? 1 : 0));
}

/** tank 는 실제로 칠할 민소매 색(머리띠 색을 정한다) */
export function spriteShapeOf(c: LookInput, tank: string): SpriteShape {
  return {
    hair: resolveSeedFeatures(c.avatarSeed || "seed").hairStyle,
    female: c.gender === "FEMALE",
    stage: bodyStageFor(c),
    band: tierStepOf(c.tier) >= 4 ? headbandFor(tank) : null,
  };
}
