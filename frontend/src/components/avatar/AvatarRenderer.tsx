import { useId } from "react";
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
import "./avatar.css";

type Props = {
  avatarSeed: AvatarSeed;
  growthParams?: GrowthParams | null;
  tier: CharacterTier;
  stage: number;
  mbti?: string | null;
  size?: number;
  customization?: AvatarCustomization | null;
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
  mbti,
  size = 176,
  customization,
}: Props) {
  const growth = growthParams ?? defaultGrowthParams;
  const seedFeatures = resolveSeedFeatures(avatarSeed || "seed");
  const tone = mbtiTone(mbti);
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
  const strokeColor = tone.stroke;
  const boostedStroke = growth.strokeWidth + tierPreset.strokeBoost * 0.7;
  const tierPopScale = 1 + tierStep * 0.028;
  const dynamicGlow = 7 + tierPreset.glow * 30 + growth.muscularityNormalized * 8 + tierStep * 4;
  const bodyScale = 1 + tierStep * 0.018;
  const svgId = useId().replace(/[:]/g, "");
  const faceClipId = `face-custom-clip-${svgId}`;
  const bodyClipId = `body-custom-clip-${svgId}`;
  const emblemClipId = `emblem-custom-clip-${svgId}`;
  const facePatternId = `face-custom-pattern-${svgId}`;
  const bodyPatternId = `body-custom-pattern-${svgId}`;
  const emblemPatternId = `emblem-custom-pattern-${svgId}`;
  const hasFace = Boolean(customization?.face);
  const hasBody = Boolean(customization?.body);
  const hasEmblem = Boolean(customization?.emblem);

  return (
    <div
      className={`avatar-shell-v2 ${motionClass} avatar-tier-${tier.toLowerCase()} ${tierPreset.burst ? "avatar-master-burst" : ""}`}
      style={{ width: size, height: size }}
    >
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
              <image href={customization?.face ?? ""} width={60} height={36} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          {hasBody && (
            <pattern id={bodyPatternId} patternUnits="objectBoundingBox" width={1} height={1}>
              <image href={customization?.body ?? ""} width={92} height={126} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          {hasEmblem && (
            <pattern id={emblemPatternId} patternUnits="objectBoundingBox" width={1} height={1}>
              <image href={customization?.emblem ?? ""} width={40} height={40} preserveAspectRatio="xMidYMid slice" />
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
          <Head mbti={mbti} seedFeatures={seedFeatures} strokeColor={strokeColor} skinColor={tone.skin} hairColor={tone.hair} />
          {hasBody && (
            <rect x={48} y={62} width={48} height={62} clipPath={`url(#${bodyClipId})`} fill={`url(#${bodyPatternId})`} opacity={0.45} />
          )}
          {hasFace && (
            <rect x={57} y={32} width={30} height={20} clipPath={`url(#${faceClipId})`} fill={`url(#${facePatternId})`} opacity={0.65} />
          )}
          {hasEmblem && (
            <circle cx={72} cy={88} r={8} clipPath={`url(#${emblemClipId})`} fill={`url(#${emblemPatternId})`} opacity={0.9} />
          )}
          <Effects tier={tier} stage={stage} strokeColor={strokeColor} accentColor={strokeColor} />
        </g>
      </svg>
    </div>
  );
}
