type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
type Gender = "MALE" | "FEMALE";

type Props = {
  tier: Tier;
  stage: number;
  level: number;
  gender?: Gender | null;
  size?: number;
};

const tierPalette: Record<Tier, { base: string; accent: string; glow: string }> = {
  BRONZE: { base: "#a86b3c", accent: "#d49c6a", glow: "#c97a3a" },
  SILVER: { base: "#a7adb4", accent: "#e6edf5", glow: "#b7c0c8" },
  GOLD: { base: "#c89c35", accent: "#f7d774", glow: "#f0b93b" },
  PLATINUM: { base: "#72b5b4", accent: "#b9f0ef", glow: "#7fd3d2" },
  DIAMOND: { base: "#6f8cff", accent: "#d7e3ff", glow: "#8eb0ff" },
  MASTER: { base: "#1f9d83", accent: "#7cf1d1", glow: "#3fd8b2" },
  GRANDMASTER: { base: "#7a3bd2", accent: "#d7b7ff", glow: "#b074ff" },
  CHALLENGER: { base: "#ff7a00", accent: "#ffd09a", glow: "#ff9d3d" },
};

export default function CharacterAvatar({ tier, stage, level, gender, size = 140 }: Props) {
  const palette = tierPalette[tier];
  const stageClamped = Math.max(0, Math.min(stage, 9));
  const sparkleCount = stageClamped >= 8 ? 8 : stageClamped >= 6 ? 6 : stageClamped >= 4 ? 4 : stageClamped >= 2 ? 2 : 0;
  const crownVisible = stageClamped >= 7;
  const ringVisible = stageClamped >= 1;
  const glowClass = stageClamped >= 7 ? "avatar-glow-strong" : stageClamped >= 4 ? "avatar-glow-medium" : "avatar-glow-light";
  const muscleTier = Math.min(9, Math.floor((level - 1) / 10));
  const bodyWidth = 42 + stageClamped * 3 + muscleTier * 2;
  const bodyX = 70 - bodyWidth / 2;
  const armSpread = 18 + stageClamped * 2 + muscleTier * 3;
  const shoulderSize = 5 + muscleTier;

  return (
    <div className={`relative ${glowClass}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {ringVisible && (
          <circle
            cx="70"
            cy="72"
            r="54"
            stroke={palette.glow}
            strokeWidth="4"
            opacity="0.5"
            className="avatar-ring"
          />
        )}
        <circle cx="70" cy="60" r="32" fill={palette.base} stroke={palette.accent} strokeWidth="4" />
        {gender === "FEMALE" && (
          <path d="M42 62C48 46 60 40 70 40C82 40 94 46 98 62" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" />
        )}
        {gender === "MALE" && (
          <path d="M54 72C62 78 78 78 86 72" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
        )}
        <circle cx="58" cy="56" r="4" fill="#121212" />
        <circle cx="82" cy="56" r="4" fill="#121212" />
        <path d="M60 74C65 80 75 80 80 74" stroke="#121212" strokeWidth="4" strokeLinecap="round" />
        {muscleTier >= 2 && (
          <>
            <circle cx={70 - bodyWidth / 2 + 2} cy="94" r={shoulderSize} fill={palette.accent} opacity="0.8" />
            <circle cx={70 + bodyWidth / 2 - 2} cy="94" r={shoulderSize} fill={palette.accent} opacity="0.8" />
          </>
        )}
        <line x1={70 - armSpread} y1="98" x2={70 - bodyWidth / 2} y2="104" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
        <line x1={70 + bodyWidth / 2} y1="104" x2={70 + armSpread} y2="98" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
        <rect x={bodyX} y="92" width={bodyWidth} height="32" rx="16" fill={palette.base} stroke={palette.accent} strokeWidth="4" />
        {muscleTier >= 3 && (
          <path
            d={`M${bodyX + 6} 104H${bodyX + bodyWidth - 6}`}
            stroke={palette.accent}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
        )}
        {muscleTier >= 5 && (
          <>
            <line x1={70 - armSpread + 4} y1="100" x2={70 - bodyWidth / 2 + 6} y2="110" stroke={palette.glow} strokeWidth="3" strokeLinecap="round" />
            <line x1={70 + bodyWidth / 2 - 6} y1="110" x2={70 + armSpread - 4} y2="100" stroke={palette.glow} strokeWidth="3" strokeLinecap="round" />
          </>
        )}
        {stageClamped >= 5 && (
          <path
            d={`M${bodyX + 8} 90L${bodyX + 20} 82H${bodyX + bodyWidth - 20}L${bodyX + bodyWidth - 8} 90`}
            fill={palette.accent}
            opacity="0.35"
          />
        )}
        {stageClamped >= 8 && (
          <>
            <path d="M12 98L28 88L38 104" stroke={palette.glow} strokeWidth="3" strokeLinecap="round" />
            <path d="M128 98L112 88L102 104" stroke={palette.glow} strokeWidth="3" strokeLinecap="round" />
          </>
        )}
        <text x="70" y="112" textAnchor="middle" fill={palette.accent} fontSize="14" fontWeight="700">
          Lv.{level}
        </text>

        {crownVisible && (
          <path
            d="M48 34L60 20L70 34L80 20L92 34L86 44H54L48 34Z"
            fill={palette.accent}
            stroke={palette.base}
            strokeWidth="2"
          />
        )}

        {Array.from({ length: sparkleCount }).map((_, idx) => (
          <circle
            key={idx}
            cx={20 + idx * 25}
            cy={30 + (idx % 2) * 10}
            r="3"
            fill={palette.accent}
            className={`avatar-sparkle sparkle-${idx + 1}`}
          />
        ))}
      </svg>
    </div>
  );
}
