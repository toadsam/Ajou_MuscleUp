import { TIER_PRESETS } from "./tierPreset";
import type { CharacterTier } from "./types";
import type { EvolutionBranch } from "../../utils/evolutionProgress";

type Props = {
  tier: CharacterTier;
  stage: number;
  strokeColor: string;
  accentColor: string;
  archetype?: string;
  evolutionBranch?: EvolutionBranch;
  skillLevel?: number;
  activeSkillIds?: string[];
};

export default function Effects({ tier, stage, strokeColor, accentColor, archetype, evolutionBranch, skillLevel = 0, activeSkillIds = [] }: Props) {
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
  const ringOpacity = 0.12 + preset.auraIntensity * 0.28 + skillLevel * 0.02;
  const ringScale = 1 + tierStep * 0.035;
  const waveBoost = tierStep >= 4 ? 1 + (tierStep - 3) * 0.06 : 1;
  const followerCount = tierStep >= 5 ? 2 : tierStep >= 2 ? 1 : 0;
  const activeSkills = new Set(activeSkillIds);
  const auraOn = activeSkills.has("aura");
  const waveOn = activeSkills.has("wave");
  const branchOn = activeSkills.has("branch");
  const overdriveUnlocked = activeSkills.has("burst");
  const auraColor = "#22d3ee";
  const waveColor = "#a78bfa";
  const burstColor = "#facc15";
  const branchColor =
    evolutionBranch === "TITAN" ? "#f97316" :
    evolutionBranch === "BLAZE" ? "#ef4444" :
    evolutionBranch === "PHANTOM" ? "#2dd4bf" :
    accentColor;
  const activeAnySkill = auraOn || waveOn || branchOn || overdriveUnlocked;
  const dominantSkillColor = overdriveUnlocked
    ? burstColor
    : auraOn
      ? auraColor
      : waveOn
        ? waveColor
        : branchOn
          ? branchColor
          : accentColor;
  const skillImpact = (auraOn ? 1 : 0) + (waveOn ? 0.5 : 0) + (branchOn ? 1 : 0) + (overdriveUnlocked ? 1 : 0);
  const skillRingBoost = auraOn ? 2 : 0;
  const totalRingCount = preset.auraRings + skillRingBoost;
  const boostedParticleCount = particleCount + (skillImpact >= 1 ? 6 : 0);

  return (
    <g className={`${preset.pulse ? "avatar-tier-pulse" : ""}`} transform={`scale(${ringScale}) translate(${72 * (1 - ringScale)}, ${96 * (1 - ringScale)})`}>
      {activeAnySkill && (
        <ellipse
          cx={72}
          cy={96}
          rx={84}
          ry={96}
          fill={dominantSkillColor}
          opacity={0.16}
          className="avatar-skill-backdrop"
        />
      )}
      {preset.floorShadow && (
        <ellipse cx={72} cy={180} rx={32} ry={8} fill="#000000" opacity={0.28 + preset.glow * 0.2} />
      )}

      {Array.from({ length: totalRingCount }).map((_, idx) => (
        <ellipse
          key={`ring-${idx}`}
          cx={72}
          cy={96}
          rx={42 + idx * 7}
          ry={53 + idx * 7}
          fill="none"
          stroke={idx >= preset.auraRings ? accentColor : strokeColor}
          strokeWidth={1.6 + preset.strokeBoost * 0.2 + (idx >= preset.auraRings ? 0.8 : 0)}
          opacity={Math.max(0.14, ringOpacity - idx * 0.05 + (idx >= preset.auraRings ? 0.2 : 0))}
          className={`avatar-aura-ring ${idx >= preset.auraRings ? "avatar-aura-ring-skill" : ""}`}
        />
      ))}

      {preset.auraGradient && (
        <ellipse
          cx={72}
          cy={96}
          rx={58 + (auraOn ? 8 : 0)}
          ry={68 + (auraOn ? 8 : 0)}
          fill="url(#tierAuraGradient)"
          opacity={0.14 + preset.auraIntensity * 0.18 + (auraOn ? 0.24 : 0)}
          className={auraOn ? "avatar-skill-core-glow" : ""}
        />
      )}
      {archetype === "strategist" && <rect x={58} y={14} width={28} height={4} rx={2} fill={accentColor} opacity={0.45} />}
      {archetype === "empath" && <path d="M72 14 C74 10, 80 10, 80 16 C80 20, 76 22, 72 26 C68 22, 64 20, 64 16 C64 10, 70 10, 72 14 Z" fill={accentColor} opacity={0.35} />}
      {archetype === "guardian" && <circle cx={72} cy={18} r={8} fill="none" stroke={accentColor} strokeWidth={1.5} opacity={0.35} />}
      {archetype === "adventurer" && <path d="M60 18 L84 18 L72 28 Z" fill={accentColor} opacity={0.35} />}
      {branchOn && evolutionBranch === "TITAN" && (
        <g className="avatar-branch-sigil">
          <rect x={64} y={10} width={16} height={16} rx={3} fill="none" stroke={accentColor} strokeWidth={1.8} opacity={0.8} />
          <path d="M68 18 L72 14 L76 18 L72 22 Z" fill={accentColor} opacity={0.6} />
        </g>
      )}
      {branchOn && evolutionBranch === "BLAZE" && (
        <g className="avatar-branch-sigil">
          <path d="M72 8 C79 18, 76 23, 72 28 C68 23, 65 18, 72 8 Z" fill={accentColor} opacity={0.72} />
          <path d="M72 12 C75 17, 74 20, 72 23 C70 20, 69 17, 72 12 Z" fill="#ffffff" opacity={0.45} />
        </g>
      )}
      {branchOn && evolutionBranch === "PHANTOM" && (
        <g className="avatar-branch-sigil">
          <ellipse cx={72} cy={18} rx={12} ry={5.5} fill="none" stroke={accentColor} strokeWidth={1.8} opacity={0.78} />
          <ellipse cx={72} cy={18} rx={7} ry={2.8} fill={accentColor} opacity={0.3} />
        </g>
      )}
      {auraOn && (
        <>
          <ellipse cx={72} cy={96} rx={70} ry={80} fill="none" stroke={accentColor} strokeWidth={2} opacity={0.38} className="avatar-overdrive-ring avatar-overdrive-ring-strong" />
          <ellipse cx={72} cy={96} rx={78} ry={90} fill="none" stroke={accentColor} strokeWidth={1.4} opacity={0.22} className="avatar-overdrive-ring avatar-overdrive-ring-strong" />
        </>
      )}

      {(preset.lightWave || waveOn) && (
        <ellipse
          cx={72}
          cy={96}
          rx={66 * waveBoost * (waveOn ? 1.2 : 1)}
          ry={76 * waveBoost * (waveOn ? 1.2 : 1)}
          fill="none"
          stroke={waveOn ? waveColor : "#ffffff"}
          strokeWidth={2.2 + tierStep * 0.18 + (waveOn ? 1 : 0)}
          opacity={0.22 + tierStep * 0.03 + (waveOn ? 0.18 : 0)}
          className={`avatar-light-wave ${waveOn ? "avatar-light-wave-boost" : ""}`}
        />
      )}
      {waveOn && (
        <ellipse
          cx={72}
          cy={96}
          rx={84 * waveBoost}
          ry={96 * waveBoost}
          fill="none"
          stroke={waveColor}
          strokeWidth={1.8}
          opacity={0.46}
          className="avatar-wave-ring-secondary"
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
      {overdriveUnlocked && (
        <>
          <circle cx={72} cy={96} r={70} fill="none" stroke={burstColor} strokeWidth={1.9} opacity={0.56} className="avatar-overdrive-ring avatar-overdrive-ring-strong" />
          <circle cx={72} cy={96} r={78} fill="none" stroke={burstColor} strokeWidth={1.2} opacity={0.38} className="avatar-overdrive-ring avatar-overdrive-ring-strong" />
          <circle cx={72} cy={96} r={18} fill={burstColor} opacity={0.2} className="avatar-overdrive-core" />
          {Array.from({ length: 8 }).map((_, idx) => {
            const angle = (Math.PI * 2 * idx) / 8;
            const sx = 72 + Math.cos(angle) * 54;
            const sy = 96 + Math.sin(angle) * 54;
            const ex = 72 + Math.cos(angle) * 74;
            const ey = 96 + Math.sin(angle) * 74;
            return (
              <line
                key={`burst-spark-${idx}`}
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke={burstColor}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.9}
                className="avatar-burst-spark"
                style={{ animationDelay: `${idx * 70}ms` }}
              />
            );
          })}
        </>
      )}

      {Array.from({ length: boostedParticleCount }).map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / boostedParticleCount;
        const radius = (44 + (idx % 4) * 6) * (1 + tierStep * 0.03);
        const x = 72 + Math.cos(angle) * radius;
        const y = 96 + Math.sin(angle) * radius;
        return (
          <circle
            key={`particle-${idx}`}
            cx={x}
            cy={y}
            r={1 + (idx % 3) * 0.5}
            fill={activeAnySkill ? (idx % 2 === 0 ? dominantSkillColor : "#ffffff") : (idx % 2 === 0 ? strokeColor : "#ffffff")}
            opacity={0.25 + preset.auraIntensity * 0.5 + (skillImpact >= 1 ? 0.15 : 0)}
            className={`${preset.burst ? "avatar-particle-burst" : "avatar-particle"} ${skillImpact >= 1 ? "avatar-particle-skill" : ""}`}
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
