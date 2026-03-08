import { TIER_PRESETS } from "./tierPreset";
import type { CharacterTier } from "./types";

type Props = {
  tier: CharacterTier;
  stage: number;
  strokeColor: string;
  accentColor: string;
  archetype?: string;
};

export default function Effects({ tier, stage, strokeColor, accentColor, archetype }: Props) {
  const preset = TIER_PRESETS[tier];
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
  const particleCount = preset.particles + Math.max(0, Math.floor(stage / 2));
  const ringOpacity = 0.12 + preset.auraIntensity * 0.28;
  const ringScale = 1 + tierStep * 0.035;
  const waveBoost = tierStep >= 4 ? 1 + (tierStep - 3) * 0.06 : 1;
  const followerCount = tierStep >= 5 ? 2 : tierStep >= 2 ? 1 : 0;

  return (
    <g className={`${preset.pulse ? "avatar-tier-pulse" : ""}`} transform={`scale(${ringScale}) translate(${72 * (1 - ringScale)}, ${96 * (1 - ringScale)})`}>
      {preset.floorShadow && (
        <ellipse cx={72} cy={180} rx={32} ry={8} fill="#000000" opacity={0.28 + preset.glow * 0.2} />
      )}

      {Array.from({ length: preset.auraRings }).map((_, idx) => (
        <ellipse
          key={`ring-${idx}`}
          cx={72}
          cy={96}
          rx={42 + idx * 7}
          ry={53 + idx * 7}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.6 + preset.strokeBoost * 0.2}
          opacity={ringOpacity - idx * 0.05}
          className="avatar-aura-ring"
        />
      ))}

      {preset.auraGradient && (
        <ellipse cx={72} cy={96} rx={58} ry={68} fill="url(#tierAuraGradient)" opacity={0.14 + preset.auraIntensity * 0.18} />
      )}
      {archetype === "strategist" && <rect x={58} y={14} width={28} height={4} rx={2} fill={accentColor} opacity={0.45} />}
      {archetype === "empath" && <path d="M72 14 C74 10, 80 10, 80 16 C80 20, 76 22, 72 26 C68 22, 64 20, 64 16 C64 10, 70 10, 72 14 Z" fill={accentColor} opacity={0.35} />}
      {archetype === "guardian" && <circle cx={72} cy={18} r={8} fill="none" stroke={accentColor} strokeWidth={1.5} opacity={0.35} />}
      {archetype === "adventurer" && <path d="M60 18 L84 18 L72 28 Z" fill={accentColor} opacity={0.35} />}

      {preset.lightWave && (
        <ellipse
          cx={72}
          cy={96}
          rx={66 * waveBoost}
          ry={76 * waveBoost}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.2 + tierStep * 0.18}
          opacity={0.22 + tierStep * 0.03}
          className="avatar-light-wave"
        />
      )}

      {preset.sigil && (
        <path
          d="M72 14 L79 24 L92 24 L82 33 L86 46 L72 38 L58 46 L62 33 L52 24 L65 24 Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5 + preset.strokeBoost * 0.25}
          opacity={0.6}
        />
      )}

      {preset.energyRing && <circle cx={72} cy={96} r={63} fill="none" stroke={strokeColor} strokeWidth={2} opacity={0.4} className="avatar-energy-ring" />}

      {Array.from({ length: particleCount }).map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / particleCount;
        const radius = (44 + (idx % 4) * 6) * (1 + tierStep * 0.03);
        const x = 72 + Math.cos(angle) * radius;
        const y = 96 + Math.sin(angle) * radius;
        return (
          <circle
            key={`particle-${idx}`}
            cx={x}
            cy={y}
            r={1 + (idx % 3) * 0.5}
            fill={idx % 2 === 0 ? strokeColor : "#ffffff"}
            opacity={0.25 + preset.auraIntensity * 0.5}
            className={preset.burst ? "avatar-particle-burst" : "avatar-particle"}
            style={{ animationDelay: `${idx * 40}ms` }}
          />
        );
      })}

      {Array.from({ length: followerCount }).map((_, idx) => {
        const baseX = idx === 0 ? 30 : 114;
        const baseY = idx === 0 ? 128 : 82;
        return (
          <g key={`dumbbell-follower-${idx}`} className="avatar-dumbbell-follower" style={{ animationDelay: `${idx * 180}ms` }}>
            <rect x={baseX - 7} y={baseY - 1.2} width={14} height={2.4} rx={1.2} fill={accentColor} opacity={0.9} />
            <rect x={baseX - 10} y={baseY - 4} width={3} height={8} rx={1.2} fill={strokeColor} />
            <rect x={baseX + 7} y={baseY - 4} width={3} height={8} rx={1.2} fill={strokeColor} />
          </g>
        );
      })}
    </g>
  );
}
