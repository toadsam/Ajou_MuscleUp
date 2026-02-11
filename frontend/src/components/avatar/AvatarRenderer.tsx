import Arms from "./Arms";
import Effects from "./Effects";
import Head from "./Head";
import Legs from "./Legs";
import Torso from "./Torso";
import { resolveSeedFeatures } from "./seed";
import { TIER_PRESETS } from "./tierPreset";
import type { AvatarSeed, CharacterTier, GrowthParams } from "./types";
import { defaultGrowthParams } from "./types";
import "./avatar.css";

type Props = {
  avatarSeed: AvatarSeed;
  growthParams?: GrowthParams | null;
  tier: CharacterTier;
  stage: number;
  mbti?: string | null;
  size?: number;
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
}: Props) {
  const growth = growthParams ?? defaultGrowthParams;
  const seedFeatures = resolveSeedFeatures(avatarSeed || "seed");
  const tone = mbtiTone(mbti);
  const tierPreset = TIER_PRESETS[tier];
  const motionClass = mbtiMotionClass(mbti);
  const strokeColor = tone.stroke;
  const boostedStroke = growth.strokeWidth + tierPreset.strokeBoost * 0.35;
  const tierPopScale = 1 + tierPreset.auraIntensity * 0.035;
  const dynamicGlow = 8 + tierPreset.glow * 28 + growth.muscularityNormalized * 7;

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
        </defs>

        <g style={{ filter: `drop-shadow(0 0 ${dynamicGlow}px ${strokeColor}) contrast(${growth.contrastBoost})` }}>
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
          <Effects tier={tier} stage={stage} strokeColor={strokeColor} />
        </g>
      </svg>
    </div>
  );
}
