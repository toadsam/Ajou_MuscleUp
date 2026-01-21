type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

type Props = {
  tier: Tier;
  stage: number;
  level: number;
  size?: number;
};

const tierPalette: Record<Tier, { base: string; accent: string; glow: string }> = {
  BRONZE: { base: "#a86b3c", accent: "#d49c6a", glow: "#c97a3a" },
  SILVER: { base: "#a7adb4", accent: "#e6edf5", glow: "#b7c0c8" },
  GOLD: { base: "#c89c35", accent: "#f7d774", glow: "#f0b93b" },
  PLATINUM: { base: "#72b5b4", accent: "#b9f0ef", glow: "#7fd3d2" },
  DIAMOND: { base: "#6f8cff", accent: "#d7e3ff", glow: "#8eb0ff" },
};

export default function CharacterAvatar({ tier, stage, level, size = 140 }: Props) {
  const palette = tierPalette[tier];
  const sparkleCount = stage >= 2 ? 4 : stage === 1 ? 2 : 0;
  const crownVisible = stage >= 3;
  const ringVisible = stage >= 1;
  const glowClass = stage >= 3 ? "avatar-glow-strong" : stage === 2 ? "avatar-glow-medium" : "avatar-glow-light";

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
        <circle cx="58" cy="56" r="4" fill="#121212" />
        <circle cx="82" cy="56" r="4" fill="#121212" />
        <path d="M60 74C65 80 75 80 80 74" stroke="#121212" strokeWidth="4" strokeLinecap="round" />
        <rect x="45" y="92" width="50" height="30" rx="14" fill={palette.base} stroke={palette.accent} strokeWidth="4" />
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
