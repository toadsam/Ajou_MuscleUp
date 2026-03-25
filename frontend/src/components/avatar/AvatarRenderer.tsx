import { useEffect, useId, useState } from "react";
import Arms from "./Arms";
import Effects from "./Effects";
import Head from "./Head";
import Legs from "./Legs";
import Torso from "./Torso";
import { resolveSeedFeatures } from "./seed";
import { TIER_PRESETS } from "./tierPreset";
import type { AvatarSeed, CharacterTier, GrowthParams } from "./types";
import { defaultGrowthParams } from "./types";
import type { AvatarCustomization } from "../../utils/avatarCustomization";
import { amplifyGrowthParams, branchTheme, type EvolutionBranch } from "../../utils/evolutionProgress";
import { AVATAR_APPEARANCE_EVENT, loadAppearanceBySeed } from "../../utils/avatarAppearanceState";
import "./avatar.css";

type Props = {
  avatarSeed: AvatarSeed;
  growthParams?: GrowthParams | null;
  tier: CharacterTier;
  stage: number;
  gender?: "MALE" | "FEMALE" | null;
  mbti?: string | null;
  isResting?: boolean;
  size?: number;
  customization?: AvatarCustomization | null;
  evolutionBranch?: EvolutionBranch | null;
  unlockedSkillCount?: number;
  activeSkillIds?: string[];
};

const mbtiTone = (mbti?: string | null) => {
  const v = (mbti ?? "").toUpperCase();
  if (v.includes("NT")) return { skin: "#f3c7a9", suit: "#2563eb", hair: "#1e293b", stroke: "#0f172a" };
  if (v.includes("NF")) return { skin: "#f4c8b4", suit: "#ea580c", hair: "#3f3f46", stroke: "#18181b" };
  if (v.includes("SJ")) return { skin: "#edc2a5", suit: "#15803d", hair: "#292524", stroke: "#0f172a" };
  if (v.includes("SP")) return { skin: "#f1c6aa", suit: "#b91c1c", hair: "#1f2937", stroke: "#111827" };
  return { skin: "#f1c4a5", suit: "#475569", hair: "#1f2937", stroke: "#0f172a" };
};

const mbtiMotionClass = (mbti?: string | null) => {
  const v = (mbti ?? "").toUpperCase();
  if (v.startsWith("E")) return "avatar-motion-energetic";
  if (v.startsWith("I")) return "avatar-motion-calm";
  return "";
};

export default function AvatarRenderer({
  avatarSeed,
  growthParams,
  tier,
  stage,
  gender,
  mbti,
  isResting = false,
  size = 176,
  customization,
  evolutionBranch,
  unlockedSkillCount = 0,
  activeSkillIds = [],
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
  const resolvedGender = gender ?? persistedAppearance?.gender ?? "MALE";
  const resolvedResting = isResting ?? persistedAppearance?.isResting ?? false;

  const rawGrowth = growthParams ?? defaultGrowthParams;
  const growth = resolvedBranch ? amplifyGrowthParams(rawGrowth, resolvedBranch, resolvedSkillCount) : rawGrowth;
  const seedFeatures = resolveSeedFeatures(avatarSeed || "seed");
  const tone = mbtiTone(mbti);
  const branch = resolvedBranch ? branchTheme(resolvedBranch) : null;
  const tierPreset = TIER_PRESETS[tier];
  const tierStep = ({
    BRONZE: 0,
    SILVER: 1,
    GOLD: 2,
    PLATINUM: 3,
    DIAMOND: 4,
    MASTER: 5,
    GRANDMASTER: 6,
    CHALLENGER: 7,
  } as const)[tier];
  const motionClass = mbtiMotionClass(mbti);
  const strokeColor = branch?.accent ?? tone.stroke;
  const boostedStroke = growth.strokeWidth + tierPreset.strokeBoost * 0.7;
  const tierPopScale = 1 + tierStep * 0.03 + resolvedSkillCount * 0.01;
  const dynamicGlow = 8 + tierPreset.glow * 34 + growth.muscularityNormalized * 10 + tierStep * 4 + resolvedSkillCount * 2;
  const bodyScale = 1 + tierStep * 0.02 + growth.muscularityNormalized * 0.02;
  const svgId = useId().replace(/[:]/g, "");
  const faceClipId = `face-custom-clip-${svgId}`;
  const bodyClipId = `body-custom-clip-${svgId}`;
  const emblemClipId = `emblem-custom-clip-${svgId}`;
  const facePatternId = `face-custom-pattern-${svgId}`;
  const bodyPatternId = `body-custom-pattern-${svgId}`;
  const emblemPatternId = `emblem-custom-pattern-${svgId}`;
  const hasFace = Boolean(resolvedCustomization?.face);
  const hasBody = Boolean(resolvedCustomization?.body);
  const hasEmblem = Boolean(resolvedCustomization?.emblem);

  return (
    <div
      className={`avatar-shell-v2 ${motionClass} avatar-tier-${tier.toLowerCase()} ${resolvedGender === "FEMALE" ? "avatar-gender-female" : "avatar-gender-male"} ${resolvedResting ? "avatar-resting" : ""} ${tierPreset.burst ? "avatar-master-burst" : ""}`}
      style={{ width: size, height: size }}
    >
      {resolvedResting && (
        <>
          <div className="avatar-rest-banner">휴식 중</div>
          <div className="avatar-rest-cloud cloud-left" aria-hidden="true" />
          <div className="avatar-rest-cloud cloud-right" aria-hidden="true" />
        </>
      )}
      <svg
        viewBox="0 0 144 192"
        width={size}
        height={size}
        role="img"
        aria-label="assembled-avatar"
        style={{ transform: `scale(${tierPopScale})`, transition: "transform 280ms ease-out" }}
      >
        <defs>
          <radialGradient id="tierAuraGradient">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.75" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </radialGradient>
          <clipPath id={faceClipId}>
            <ellipse cx={72} cy={42} rx={14} ry={8.5} />
          </clipPath>
          <clipPath id={bodyClipId}>
            <ellipse cx={72} cy={93} rx={22} ry={31} />
          </clipPath>
          <clipPath id={emblemClipId}>
            <circle cx={72} cy={88} r={8} />
          </clipPath>
          {hasFace && (
            <pattern id={facePatternId} patternUnits="objectBoundingBox" width={1} height={1}>
              <image href={resolvedCustomization?.face ?? ""} width={60} height={36} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          {hasBody && (
            <pattern id={bodyPatternId} patternUnits="objectBoundingBox" width={1} height={1}>
              <image href={resolvedCustomization?.body ?? ""} width={92} height={126} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          {hasEmblem && (
            <pattern id={emblemPatternId} patternUnits="objectBoundingBox" width={1} height={1}>
              <image href={resolvedCustomization?.emblem ?? ""} width={40} height={40} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
        </defs>

        <g
          style={{
            filter: `drop-shadow(0 0 ${dynamicGlow}px ${strokeColor}) contrast(${growth.contrastBoost})`,
            transform: `scale(${bodyScale})`,
            transformOrigin: "72px 96px",
          }}
        >
          <Legs growthParams={{ ...growth, strokeWidth: boostedStroke }} seedFeatures={seedFeatures} strokeColor={strokeColor} bodyColor={tone.skin} />
          <Torso growthParams={{ ...growth, strokeWidth: boostedStroke }} seedFeatures={seedFeatures} strokeColor={strokeColor} suitColor={tone.suit} />
          <Arms
            growthParams={{ ...growth, strokeWidth: boostedStroke }}
            tierBoost={tierPreset.auraIntensity}
            seedFeatures={seedFeatures}
            strokeColor={strokeColor}
            skinColor={tone.skin}
          />
          <Head
            gender={resolvedGender}
            mbti={mbti}
            isResting={resolvedResting}
            seedFeatures={seedFeatures}
            strokeColor={strokeColor}
            skinColor={tone.skin}
            hairColor={tone.hair}
          />
          {resolvedGender === "FEMALE" && (
            <>
              <path
                d="M 54 66 Q 72 55 90 66 L 97 86 Q 90 106 72 111 Q 54 106 47 86 Z"
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.2"
              />
              <path
                d="M 72 62 C 68 70, 66 78, 66 92"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 72 62 C 76 70, 78 78, 78 92"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {hasBody && (
            <rect x={48} y={62} width={48} height={62} clipPath={`url(#${bodyClipId})`} fill={`url(#${bodyPatternId})`} opacity={0.45} />
          )}
          {hasFace && (
            <rect x={57} y={32} width={30} height={20} clipPath={`url(#${faceClipId})`} fill={`url(#${facePatternId})`} opacity={0.65} />
          )}
          {hasEmblem && (
            <circle cx={72} cy={88} r={8} clipPath={`url(#${emblemClipId})`} fill={`url(#${emblemPatternId})`} opacity={0.9} />
          )}
          <Effects
            tier={tier}
            stage={stage}
            strokeColor={strokeColor}
            accentColor={strokeColor}
            archetype={branch?.archetype}
            evolutionBranch={resolvedBranch ?? undefined}
            skillLevel={resolvedSkillCount}
            activeSkillIds={resolvedSkillIds}
          />
          {resolvedResting && (
            <>
              <rect x={56} y={18} width={32} height={10} rx={4} fill="#dbeafe" stroke="#60a5fa" strokeWidth={1.6} opacity={0.96} transform="rotate(-8 72 23)" />
              <path d="M 57 24 L 87 19" stroke="#93c5fd" strokeWidth={1.3} opacity={0.9} />
              <path d="M 84 30 Q 94 28 99 38" stroke="#60a5fa" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.9} />
              <path d="M 98 39 Q 92 44 98 49" stroke="#38bdf8" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.82} />
              <path d="M 72 186 Q 68 189 64 186" stroke="#64748b" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85} />
              <ellipse cx={72} cy={187} rx={28} ry={4} fill="#0f172a" opacity={0.22} />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
