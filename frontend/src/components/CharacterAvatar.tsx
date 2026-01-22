import React from "react";

type Tier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type Gender = "MALE" | "FEMALE";

type Props = {
  gender: Gender;
  tier: Tier;
  stage: number;
  level: number;
  size?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const tierPalette: Record<Tier, { base: string; accent: string; glow: string }> = {
  BRONZE: { base: "#7a4b2a", accent: "#d59a6a", glow: "#b8743b" },
  SILVER: { base: "#9aa5b1", accent: "#e2e8f0", glow: "#c3ccd6" },
  GOLD: { base: "#b98c2c", accent: "#f7d37a", glow: "#f2b845" },
  PLATINUM: { base: "#5fb3b0", accent: "#c2f0ee", glow: "#7edbd8" },
  DIAMOND: { base: "#5d7cff", accent: "#d6e4ff", glow: "#8fb2ff" },
  MASTER: { base: "#1f9d83", accent: "#7ef3d4", glow: "#3ddcba" },
  GRANDMASTER: { base: "#7a3bd2", accent: "#e0c1ff", glow: "#b78bff" },
  CHALLENGER: { base: "#ff7a00", accent: "#ffd29a", glow: "#ff9f3d" },
};

const getTierRing = (tier: Tier) => {
  switch (tier) {
    case "PLATINUM":
      return 2;
    case "DIAMOND":
    case "MASTER":
    case "GRANDMASTER":
    case "CHALLENGER":
      return 3;
    default:
      return 1;
  }
};

export default function CharacterAvatar({
  gender,
  tier,
  stage,
  level,
  size = 160,
}: Props) {
  const stageClamped = clamp(stage, 0, 9);
  const progress = stageClamped / 9;
  const palette = tierPalette[tier];
  const centerX = 100;

  const postureScale = lerp(0.92, 1.06, progress);
  const bounceClass = stageClamped >= 3 ? "avatar-bounce" : "";
  const breatheClass = "avatar-breathe";
  const auraClass = stageClamped >= 6 ? "avatar-aura" : "";
  const sparkleCount = stageClamped >= 8 ? 8 : stageClamped >= 6 ? 5 : 0;

  const maleShoulder = lerp(1, 1.6, progress);
  const maleArm = lerp(1, 1.8, progress);
  const maleChest = lerp(1, 1.5, progress);
  const maleWaist = lerp(1, 0.8, progress);
  const maleHip = lerp(0.95, 0.9, progress);
  const maleLat = stageClamped >= 7 ? lerp(1, 1.35, (stageClamped - 7) / 2) : 1;

  const femaleHip = lerp(1, 1.4, progress);
  const femaleWaist = lerp(1, 0.75, progress);
  const femaleShoulder = lerp(1, 1.25, progress);
  const femaleArm = lerp(1, 1.35, progress);
  const femaleChest = lerp(1, 1.2, progress);

  const baseTorso = 62;
  const baseWaist = 46;
  const baseHip = 58;

  const shoulderW =
    baseTorso * (gender === "MALE" ? maleShoulder : femaleShoulder);
  const chestW = baseTorso * (gender === "MALE" ? maleChest : femaleChest);
  const waistW = baseWaist * (gender === "MALE" ? maleWaist : femaleWaist);
  const hipW = baseHip * (gender === "MALE" ? maleHip : femaleHip);

  const latW = chestW * maleLat;
  const armW = 10 * (gender === "MALE" ? maleArm : femaleArm);

  const headR = 22 - progress * 2;
  const legW = 14 + progress * 4;
  const legGap = 8 - progress * 2;
  const legLength = 38 + progress * 10;

  const yTop = 56;
  const yChest = 90;
  const yWaist = 126;
  const yHip = 154;
  const yBottom = 180;

  const torsoPath = `M ${centerX - shoulderW / 2} ${yTop}
    Q ${centerX - shoulderW / 2} ${yChest - 8}, ${centerX - chestW / 2} ${yChest}
    Q ${centerX - waistW / 2} ${yWaist - 6}, ${centerX - waistW / 2} ${yWaist}
    Q ${centerX - hipW / 2} ${yHip - 4}, ${centerX - hipW / 2} ${yHip}
    Q ${centerX - hipW / 2} ${yBottom}, ${centerX - hipW * 0.45} ${yBottom}
    L ${centerX + hipW * 0.45} ${yBottom}
    Q ${centerX + hipW / 2} ${yBottom}, ${centerX + hipW / 2} ${yHip}
    Q ${centerX + hipW / 2} ${yWaist - 4}, ${centerX + waistW / 2} ${yWaist}
    Q ${centerX + chestW / 2} ${yChest - 6}, ${centerX + chestW / 2} ${yChest}
    Q ${centerX + shoulderW / 2} ${yChest - 8}, ${centerX + shoulderW / 2} ${yTop}
    Z`;

  const latPath = `M ${centerX - latW / 2} ${yChest + 10}
    Q ${centerX - latW / 2 - 8} ${yWaist}, ${centerX - chestW / 2} ${yHip}
    L ${centerX + chestW / 2} ${yHip}
    Q ${centerX + latW / 2 + 8} ${yWaist}, ${centerX + latW / 2} ${yChest + 10}
    Z`;

  const beltVisible = stageClamped >= 6;
  const wristVisible = stageClamped >= 4;
  const gloveVisible = stageClamped >= 5;
  const headbandVisible = stageClamped >= 3;
  const crownVisible = stageClamped >= 8 || tier === "GRANDMASTER" || tier === "CHALLENGER";
  const wingVisible = stageClamped >= 8;
  const runeVisible = tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";

  const ringCount = getTierRing(tier);

  return (
    <div
      className={`relative ${breatheClass} ${bounceClass} ${auraClass}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 240"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="character-avatar"
      >
        <g className="background-layer">
          {Array.from({ length: ringCount }).map((_, idx) => (
            <circle
              key={idx}
              cx={centerX}
              cy={110}
              r={68 + idx * 6}
              stroke={palette.glow}
              strokeWidth={2}
              opacity={0.28 - idx * 0.05}
              className="avatar-ring"
            />
          ))}
          {stageClamped >= 6 && (
            <ellipse
              cx={centerX}
              cy={110}
              rx={70}
              ry={82}
              fill={palette.glow}
              opacity={0.08}
              className="avatar-wave"
            />
          )}
          {stageClamped >= 8 && (
            <ellipse
              cx={centerX}
              cy={110}
              rx={84}
              ry={98}
              fill={palette.glow}
              opacity={0.12}
              className="avatar-wave-strong"
            />
          )}
          {Array.from({ length: sparkleCount }).map((_, idx) => (
            <circle
              key={`spark-${idx}`}
              cx={30 + idx * 18}
              cy={36 + (idx % 3) * 18}
              r={3 + (idx % 2)}
              fill={palette.accent}
              className={`avatar-sparkle sparkle-${idx + 1}`}
            />
          ))}
        </g>

        <g className="decoration-layer">
          {runeVisible && (
            <g opacity={0.5}>
              <circle cx={centerX} cy={40} r={16} stroke={palette.accent} strokeWidth={2} fill="none" />
              <path
                d={`M ${centerX - 10} 40 L ${centerX} 30 L ${centerX + 10} 40 L ${centerX} 50 Z`}
                fill={palette.accent}
                opacity={0.4}
              />
            </g>
          )}
          {headbandVisible && (
            <rect
              x={centerX - headR}
              y={40}
              width={headR * 2}
              height={8}
              rx={4}
              fill={palette.accent}
              opacity={0.7}
            />
          )}
          {beltVisible && (
            <rect
              x={centerX - waistW / 2}
              y={yWaist - 6}
              width={waistW}
              height={10}
              rx={5}
              fill={palette.base}
              stroke={palette.accent}
              strokeWidth={2}
            />
          )}
          {wingVisible && (
            <g opacity={0.6}>
              <path
                d={`M ${centerX - 70} 108 Q ${centerX - 110} 88, ${centerX - 120} 120 Q ${centerX - 100} 132, ${centerX - 70} 130`}
                fill={palette.glow}
              />
              <path
                d={`M ${centerX + 70} 108 Q ${centerX + 110} 88, ${centerX + 120} 120 Q ${centerX + 100} 132, ${centerX + 70} 130`}
                fill={palette.glow}
              />
            </g>
          )}
          {crownVisible && (
            <path
              d={`M ${centerX - 28} 20 L ${centerX - 10} 6 L ${centerX} 20 L ${centerX + 10} 6 L ${centerX + 28} 20 L ${centerX + 22} 30 H ${centerX - 22} Z`}
              fill={palette.accent}
              stroke={palette.base}
              strokeWidth={2}
            />
          )}
          {stageClamped >= 8 && (
            <g>
              <path
                d={`M ${centerX - 40} 170 L ${centerX - 30} 150 L ${centerX - 20} 170`}
                stroke={palette.glow}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <path
                d={`M ${centerX + 40} 170 L ${centerX + 30} 150 L ${centerX + 20} 170`}
                stroke={palette.glow}
                strokeWidth={4}
                strokeLinecap="round"
              />
            </g>
          )}
        </g>

        <g
          className={`body-layer ${breatheClass}`}
          style={{ transformOrigin: `${centerX}px 150px`, transform: `scaleY(${postureScale})` }}
        >
          <g opacity={stageClamped >= 7 ? 1 : 0}>
            <path d={latPath} fill={palette.base} opacity={0.35} />
          </g>

          <circle
            cx={centerX}
            cy={30}
            r={headR}
            fill={gender === "MALE" ? "#f3c9a9" : "#f5c6b8"}
            stroke={palette.accent}
            strokeWidth={3}
          />
          <circle cx={centerX - 8} cy={28} r={3} fill="#1f2937" />
          <circle cx={centerX + 8} cy={28} r={3} fill="#1f2937" />
          <path d={`M ${centerX - 8} 38 Q ${centerX} 44, ${centerX + 8} 38`} stroke="#1f2937" strokeWidth={3} strokeLinecap="round" />

          <path d={torsoPath} fill={palette.base} stroke={palette.accent} strokeWidth={3} />

          <rect
            x={centerX - shoulderW / 2 - armW + 4}
            y={yTop + 8}
            width={armW}
            height={70}
            rx={armW / 2}
            fill={gender === "MALE" ? "#f0c2a2" : "#f4bfb0"}
          />
          <rect
            x={centerX + shoulderW / 2 - 4}
            y={yTop + 8}
            width={armW}
            height={70}
            rx={armW / 2}
            fill={gender === "MALE" ? "#f0c2a2" : "#f4bfb0"}
          />

          {wristVisible && (
            <>
              <rect
                x={centerX - shoulderW / 2 - armW + 6}
                y={yTop + 62}
                width={armW - 6}
                height={8}
                rx={4}
                fill={palette.accent}
                opacity={0.8}
              />
              <rect
                x={centerX + shoulderW / 2 - 2}
                y={yTop + 62}
                width={armW - 6}
                height={8}
                rx={4}
                fill={palette.accent}
                opacity={0.8}
              />
            </>
          )}

          {gloveVisible && (
            <>
              <rect
                x={centerX - shoulderW / 2 - armW + 4}
                y={yTop + 72}
                width={armW}
                height={12}
                rx={6}
                fill={palette.base}
                opacity={0.7}
              />
              <rect
                x={centerX + shoulderW / 2 - 4}
                y={yTop + 72}
                width={armW}
                height={12}
                rx={6}
                fill={palette.base}
                opacity={0.7}
              />
            </>
          )}

          <rect
            x={centerX - legGap / 2 - legW}
            y={yBottom - 4}
            width={legW}
            height={legLength}
            rx={legW / 2}
            fill={gender === "MALE" ? "#d4a07f" : "#d8a48f"}
          />
          <rect
            x={centerX + legGap / 2}
            y={yBottom - 4}
            width={legW}
            height={legLength}
            rx={legW / 2}
            fill={gender === "MALE" ? "#d4a07f" : "#d8a48f"}
          />

          {stageClamped >= 6 && (
            <path
              d={`M ${centerX - waistW / 2 + 6} ${yWaist + 18} H ${centerX + waistW / 2 - 6}`}
              stroke={palette.accent}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          )}

          <text
            x={centerX}
            y={yBottom + 18}
            textAnchor="middle"
            fill={palette.accent}
            fontSize="14"
            fontWeight={700}
          >
            Lv.{level}
          </text>
        </g>

        <g className="shadow-layer">
          <ellipse cx={centerX} cy={210} rx={46} ry={10} fill="#0f172a" opacity={0.45} />
        </g>
      </svg>
    </div>
  );
}
