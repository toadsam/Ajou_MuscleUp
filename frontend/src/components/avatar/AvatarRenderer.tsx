import { useEffect, useId, useMemo, useState } from "react";
import { resolveSeedFeatures } from "./seed";
import { CELL, buildPixelAvatar, type Pose, type PixelAction, type PixelAvatarSpec } from "./pixelAvatar";
import { CHIBI_FRONT_KINDS, bodyStageOf, buildChibi, tierStepOf, type ChibiExpression, type ChibiSpec } from "./chibiArt";
import type { AvatarSeed, CharacterTier, GrowthParams } from "./types";
import { defaultGrowthParams } from "./types";
import { TIER_PRESETS } from "./tierPreset";
import type { AvatarCustomization } from "../../utils/avatarCustomization";
import { amplifyGrowthParams, type EvolutionBranch } from "../../utils/evolutionProgress";
import { AVATAR_APPEARANCE_EVENT, loadAppearanceBySeed } from "../../utils/avatarAppearanceState";
import { temperament } from "./mbti";
import "./avatar.css";

type Props = {
  avatarSeed: AvatarSeed;
  growthParams?: GrowthParams | null;
  tier: CharacterTier;
  stage: number;
  gender?: "MALE" | "FEMALE" | null;
  mbti?: string | null;
  isResting?: boolean;
  attendanceRisk?: "normal" | "warning" | "critical";
  size?: number;
  customization?: AvatarCustomization | null;
  evolutionBranch?: EvolutionBranch | null;
  unlockedSkillCount?: number;
  activeSkillIds?: string[];
  /** 운동 세션에서 따라 하는 동작(있으면 자세 대신, 꾸미기 이미지는 덮지 않는다) */
  action?: PixelAction | null;
  /** 도감에서 장착한 민소매 색(다른 사람 캐릭터 · 서버 값). 없으면 이 기기에 저장된 값 */
  tank?: string | null;
  /** 운동 직후 펌핑: 근육 한 단계 + 땀 · 김 */
  pumped?: boolean;
  /**
   * 몸 단계 0~5(서버 BodyStage — 근육량 · 레벨 · 활동 레벨 중 가장 높은 것). 없으면 근육량과 진화 단계(레벨)로 짐작한다.
   * 치비 그림(chibiArt, 2026-10-20): 서기 · 알통 · 휴식과 정면 운동 동작 9가지. 옆모습 동작(벤치 · 머신 · 러닝 등)은 pixelPoses 가 큰 머리로 그린다.
   */
  bodyStage?: number | null;
};

// 피부·머리 색은 MBTI 를 따르고, 민소매 색은 원판 팔레트에서 고른다.
const mbtiTone = (mbti?: string | null) => {
  const v = (mbti ?? "").toUpperCase();
  if (temperament(v) === "NT") return { skin: "#f3c7a9", tank: "#2F6FD0", hair: "#1e293b" };
  if (temperament(v) === "NF") return { skin: "#f4c8b4", tank: "#F0BE2E", hair: "#3f3f46" };
  if (temperament(v) === "SJ") return { skin: "#edc2a5", tank: "#2E9C55", hair: "#292524" };
  if (temperament(v) === "SP") return { skin: "#f1c6aa", tank: "#D9302A", hair: "#1f2937" };
  return { skin: "#f1c4a5", tank: "#4A4E57", hair: "#1f2937" };
};

// 진화 갈래는 원판 색 하나로 — 민소매와 가슴 마크에 쓴다.
const BRANCH_COLOR: Record<EvolutionBranch, string> = {
  TITAN: "#D9302A",
  BLAZE: "#F0BE2E",
  PHANTOM: "#2F6FD0",
};

const mbtiMotionClass = (mbti?: string | null) => {
  const v = (mbti ?? "").toUpperCase();
  if (v.startsWith("E")) return "avatar-motion-energetic";
  if (v.startsWith("I")) return "avatar-motion-calm";
  return "";
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

// 진화 단계가 오를수록 자세가 바뀐다: 서기 → 양팔 알통 → 바벨 들기
const poseForStage = (stage: number): Pose => (stage >= 6 ? "overhead" : stage >= 3 ? "flex" : "stand");

export default function AvatarRenderer({
  avatarSeed,
  growthParams,
  tier,
  stage,
  gender,
  mbti,
  isResting = false,
  attendanceRisk = "normal",
  size = 176,
  customization,
  evolutionBranch,
  unlockedSkillCount = 0,
  activeSkillIds = [],
  action = null,
  tank = null,
  pumped = false,
  bodyStage = null,
}: Props) {
  const [persistedAppearance, setPersistedAppearance] = useState(() => loadAppearanceBySeed(avatarSeed));

  useEffect(() => {
    setPersistedAppearance(loadAppearanceBySeed(avatarSeed));
  }, [avatarSeed]);

  useEffect(() => {
    const syncAppearance = (event: Event) => {
      const detail = (event as CustomEvent<{ seed?: string }>).detail;
      if (detail?.seed && detail.seed !== avatarSeed) return;
      setPersistedAppearance(loadAppearanceBySeed(avatarSeed));
    };
    window.addEventListener(AVATAR_APPEARANCE_EVENT, syncAppearance as EventListener);
    window.addEventListener("storage", syncAppearance as EventListener);
    return () => {
      window.removeEventListener(AVATAR_APPEARANCE_EVENT, syncAppearance as EventListener);
      window.removeEventListener("storage", syncAppearance as EventListener);
    };
  }, [avatarSeed]);

  const resolvedBranch = evolutionBranch ?? persistedAppearance?.branch ?? null;
  const resolvedSkillIds = activeSkillIds.length > 0 ? activeSkillIds : persistedAppearance?.activeSkillIds ?? [];
  const resolvedSkillCount = activeSkillIds.length > 0 ? unlockedSkillCount : resolvedSkillIds.length;
  const resolvedCustomization = customization ?? persistedAppearance?.customization ?? null;
  const resolvedTank = (tank && /^#[0-9A-Fa-f]{6}$/.test(tank) ? tank : null) ?? persistedAppearance?.tank ?? null;
  const resolvedGender = gender ?? persistedAppearance?.gender ?? "MALE";
  const resolvedResting = isResting ?? persistedAppearance?.isResting ?? false;
  const resolvedAttendanceRisk = resolvedResting
    ? "normal"
    : attendanceRisk !== "normal"
      ? attendanceRisk
      : persistedAppearance?.attendanceRisk ?? "normal";

  const rawGrowth = growthParams ?? defaultGrowthParams;
  const growth = resolvedBranch ? amplifyGrowthParams(rawGrowth, resolvedBranch, resolvedSkillCount) : rawGrowth;
  const tierStep = tierStepOf(tier);
  const tierPreset = TIER_PRESETS[tier];
  const motionClass = mbtiMotionClass(mbti);
  const svgId = useId().replace(/[:]/g, "");

  const skillKey = resolvedSkillIds.join(",");
  const actionKey = action ? JSON.stringify(action) : "";
  const art = useMemo(() => {
    const seed = resolveSeedFeatures(avatarSeed || "seed");
    const tone = mbtiTone(mbti);
    // 근육 단계: 근육량이 중심, 어깨 성장과 시드 체형이 조금 보탠다
    const buildScore =
      clamp01(growth.muscularityNormalized) * 2.4 +
      clamp01(growth.shoulderGrowth) * 0.6 +
      (seed.baseBuild >= 4 ? 0.4 : 0) +
      (tierStep >= 5 ? 0.3 : 0);
    const pumpedNow = pumped && !resolvedResting;
    const build = Math.max(0, Math.min(3, Math.floor(buildScore + 0.3) + (pumpedNow ? 1 : 0))) as PixelAvatarSpec["build"];
    const pose = resolvedResting ? "stand" : poseForStage(stage);
    const skills = new Set(skillKey ? skillKey.split(",") : []);
    const act = actionKey ? (JSON.parse(actionKey) as PixelAction) : null;
    const tankColor = resolvedTank ?? (resolvedBranch ? BRANCH_COLOR[resolvedBranch] : tone.tank);
    const emblem = resolvedBranch && skills.has("branch") ? BRANCH_COLOR[resolvedBranch] : null;

    // 서 있는 캐릭터(카드 · 홈 · 친구 · 모임 등) — 머리 큰 치비 B, 몸 단계 0~5
    // 정면 운동 동작(스쿼트 · 데드 · 프레스 · 컬 · 레이즈 · 플라이 · 턱걸이 · 다리 들기 · 알통)도 치비로
    const chibiAct = act && !resolvedResting && CHIBI_FRONT_KINDS.has(act.kind) ? act : null;
    if (resolvedResting || !act || chibiAct) {
      const known = bodyStage !== null && bodyStage !== undefined && Number.isFinite(bodyStage);
      const base = known
        ? Math.max(0, Math.min(5, Math.round(bodyStage as number)))
        : bodyStageOf({ muscularity: growth.muscularityNormalized, level: Math.max(1, stage) * 10 + 1, activityLevel: 0 });
      const chibiStage = Math.min(5, base + (pumpedNow ? 1 : 0)) as ChibiSpec["bodyStage"];
      const chibiPose = resolvedResting ? "stand" : pose === "stand" ? "stand" : "flex";
      const expression: ChibiExpression = chibiAct
        ? chibiAct.frame === 1
          ? chibiAct.kind === "flex"
            ? "smile"
            : "strain"
          : "normal"
        : resolvedAttendanceRisk !== "normal"
          ? "tired"
          : pumpedNow
            ? "smile"
            : chibiPose === "flex" || tierStep >= 5
              ? "smile"
              : "normal";
      return buildChibi({
        variant: "B",
        bodyStage: chibiStage,
        fat: clamp01(growth.fatNormalized) > 0.55 ? 1 : 0,
        female: resolvedGender === "FEMALE",
        hairStyle: seed.hairStyle,
        expression,
        pose: chibiPose,
        colors: { skin: tone.skin, hair: tone.hair, tank: tankColor },
        tierStep,
        resting: resolvedResting,
        emblem,
        pumped: pumpedNow,
        action: chibiAct,
        skills: { aura: skills.has("aura"), wave: skills.has("wave"), burst: skills.has("burst") },
      });
    }

    return buildPixelAvatar({
      build,
      fat: clamp01(growth.fatNormalized) > 0.55 ? 1 : 0,
      female: resolvedGender === "FEMALE",
      hairStyle: seed.hairStyle,
      eyeStyle: seed.eyeStyle % 3,
      pose,
      tierStep,
      plates: pose === "overhead" ? Math.min(3, stage - 5) : 0,
      resting: resolvedResting,
      risk: resolvedAttendanceRisk,
      colors: {
        skin: tone.skin,
        hair: tone.hair,
        // 도감에서 고른 민소매 색이 있으면 그 색(진화 갈래 색보다 먼저)
        tank: resolvedTank ?? (resolvedBranch ? BRANCH_COLOR[resolvedBranch] : tone.tank),
      },
      emblem: resolvedBranch && skills.has("branch") ? BRANCH_COLOR[resolvedBranch] : null,
      skills: {
        aura: skills.has("aura"),
        wave: skills.has("wave"),
        burst: skills.has("burst"),
      },
      action: resolvedResting ? null : act,
      pumped: pumpedNow,
    });
  }, [
    avatarSeed,
    mbti,
    growth.muscularityNormalized,
    growth.shoulderGrowth,
    growth.fatNormalized,
    tierStep,
    stage,
    resolvedResting,
    resolvedGender,
    resolvedAttendanceRisk,
    resolvedBranch,
    resolvedTank,
    skillKey,
    actionKey,
    pumped,
    bodyStage,
  ]);

  const y = (row: number) => row * CELL;
  const custom = action ? null : resolvedCustomization;
  const region = (r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x * CELL,
    y: y(r.y),
    width: r.w * CELL,
    height: r.h * CELL,
  });

  return (
    <div
      className={`avatar-shell-v2 ${motionClass} avatar-tier-${tier.toLowerCase()} ${resolvedGender === "FEMALE" ? "avatar-gender-female" : "avatar-gender-male"} ${resolvedResting ? "avatar-resting" : ""} ${resolvedAttendanceRisk === "warning" ? "avatar-risk-warning" : ""} ${resolvedAttendanceRisk === "critical" ? "avatar-risk-critical" : ""} ${tierPreset.burst ? "avatar-master-burst" : ""}`}
      style={{ width: size, height: size }}
    >
      {resolvedResting && <div className="avatar-rest-banner">{"휴식 중"}</div>}
      {!resolvedResting && resolvedAttendanceRisk === "warning" && (
        <div className="avatar-risk-banner warning">{"경고"}</div>
      )}
      {!resolvedResting && resolvedAttendanceRisk === "critical" && (
        <div className="avatar-risk-banner critical">{"다시 시작해요"}</div>
      )}

      <svg
        viewBox="0 0 144 192"
        width={size}
        height={size}
        role="img"
        aria-label="assembled-avatar"
        shapeRendering="crispEdges"
        // 머리 위로 든 바벨(음수 행)이 잘리지 않게
        style={{ overflow: "visible" }}
      >
        <defs>
          {custom?.face && (
            <clipPath id={`px-face-${svgId}`}>
              <rect {...region(art.regions.face)} />
            </clipPath>
          )}
          {custom?.body && (
            <clipPath id={`px-body-${svgId}`}>
              <rect {...region(art.regions.body)} />
            </clipPath>
          )}
          {custom?.emblem && (
            <clipPath id={`px-emblem-${svgId}`}>
              <rect {...region(art.regions.emblem)} />
            </clipPath>
          )}
        </defs>

        {/* 바닥 그림자 */}
        <rect x={4 * CELL} y={y(31)} width={16 * CELL} height={CELL} fill="rgba(0,0,0,0.35)" />

        {art.runs.map((run) => (
          <rect
            key={`${run.x}:${run.y}`}
            x={run.x * CELL}
            y={y(run.y)}
            width={run.w * CELL}
            height={CELL}
            fill={run.color}
          />
        ))}

        {custom?.body && (
          <image
            href={custom.body}
            {...region(art.regions.body)}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#px-body-${svgId})`}
            opacity={0.45}
          />
        )}
        {custom?.face && (
          <image
            href={custom.face}
            {...region(art.regions.face)}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#px-face-${svgId})`}
            opacity={0.65}
          />
        )}
        {custom?.emblem && (
          <image
            href={custom.emblem}
            {...region(art.regions.emblem)}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#px-emblem-${svgId})`}
            opacity={0.9}
          />
        )}

        {art.effects.map((fx, i) => (
          <rect
            key={`fx-${i}`}
            x={fx.x * CELL}
            y={y(fx.y)}
            width={fx.w * CELL}
            height={fx.h * CELL}
            fill={fx.color}
            className={fx.className || undefined}
            style={fx.delay ? { animationDelay: `${fx.delay}ms` } : undefined}
          />
        ))}
      </svg>
    </div>
  );
}

