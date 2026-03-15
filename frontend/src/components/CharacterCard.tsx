import { useEffect, useState } from "react";
import AvatarRenderer from "./avatar/AvatarRenderer";
import TierUpAnimation from "./avatar/TierUpAnimation";
import type { CharacterTier, GrowthParams } from "./avatar/types";
import type { AvatarCustomization } from "../utils/avatarCustomization";
import type { EvolutionBranch, SkillUnlock } from "../utils/evolutionProgress";

type CharacterProfile = {
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  title: string;
  isPublic: boolean;
  avatarSeed: string;
  stylePreset: string;
  growthParams?: GrowthParams | null;
};

type Evaluation = {
  threeLiftTotal: number;
  strengthRatio: number;
  bmi?: number;
  skeletalMuscleIndex?: number;
  heightWeightScore?: number;
  heightMuscleScore?: number;
  totalScore: number;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  title: string;
};

type ChangeState = {
  leveledUp: boolean;
  evolved: boolean;
  tierChanged: boolean;
};

type Props = {
  character: CharacterProfile;
  evaluation: Evaluation | null;
  mbti?: string | null;
  change?: ChangeState | null;
  customization?: AvatarCustomization | null;
  rerollBurstNonce?: number;
  evolutionBranch?: EvolutionBranch | null;
  unlockedSkills?: SkillUnlock[];
  skillEnabledMap?: Record<string, boolean>;
  onToggleSkill?: (skillId: string) => void;
};

export default function CharacterCard({
  character,
  evaluation,
  mbti,
  change,
  customization,
  rerollBurstNonce = 0,
  evolutionBranch,
  unlockedSkills = [],
  skillEnabledMap,
  onToggleSkill,
}: Props) {
  const glowClass = change?.evolved ? "card-evolution" : change?.leveledUp ? "card-levelup" : "";
  const tierBadgeClass = change?.tierChanged ? "badge-bounce" : "";
  const [rerollFx, setRerollFx] = useState(false);

  useEffect(() => {
    if (!rerollBurstNonce) return;
    setRerollFx(true);
    const timer = window.setTimeout(() => setRerollFx(false), 1400);
    return () => window.clearTimeout(timer);
  }, [rerollBurstNonce]);

  const activeSkillIds = unlockedSkills
    .filter((skill) => skill.unlocked && (skillEnabledMap?.[skill.id] ?? true))
    .map((skill) => skill.id);

  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5 ${glowClass} ${rerollFx ? "avatar-reforge-burst" : ""}`}>
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        <TierUpAnimation active={Boolean(change?.tierChanged)} tier={character.tier}>
          <AvatarRenderer
            avatarSeed={character.avatarSeed}
            growthParams={character.growthParams}
            tier={character.tier}
            stage={character.evolutionStage}
            mbti={mbti}
            size={156}
            customization={customization}
            evolutionBranch={evolutionBranch}
            unlockedSkillCount={activeSkillIds.length}
            activeSkillIds={activeSkillIds}
          />
        </TierUpAnimation>
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-white/10 ${tierBadgeClass}`}>
              {character.tier}
            </span>
            <span className="text-sm text-gray-300">Stage {character.evolutionStage}</span>
            <span className="text-xs text-gray-400">Style {character.stylePreset}</span>
          </div>
          <h3 className="text-2xl font-bold">{character.title}</h3>
          <p className="text-gray-300">Level {character.level}</p>
          {evolutionBranch && (
            <span className="inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-gray-100">
              BRANCH - {evolutionBranch}
            </span>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>Total Score</span>
              <span className="text-white font-semibold">{evaluation?.totalScore ?? 0}/100</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-500 transition-all"
                style={{ width: `${Math.min(evaluation?.totalScore ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {evaluation && (
        <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-300">
          <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">3-Lift Total</div>
            <div className="text-lg font-semibold text-white">{evaluation.threeLiftTotal}</div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Strength Ratio</div>
            <div className="text-lg font-semibold text-white">{evaluation.strengthRatio}</div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Tier</div>
            <div className="text-lg font-semibold text-white">{evaluation.tier}</div>
          </div>
          {evaluation.bmi !== undefined && (
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">BMI / Height-Weight</div>
              <div className="text-lg font-semibold text-white">
                {evaluation.bmi} ({evaluation.heightWeightScore ?? 0}p)
              </div>
            </div>
          )}
          {evaluation.skeletalMuscleIndex !== undefined && (
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">SMI / Height-Muscle</div>
              <div className="text-lg font-semibold text-white">
                {evaluation.skeletalMuscleIndex} ({evaluation.heightMuscleScore ?? 0}p)
              </div>
            </div>
          )}
        </div>
      )}

      {unlockedSkills.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {unlockedSkills.map((skill) => (
            <div key={skill.id} className={`rounded-2xl border p-3 text-xs ${skill.unlocked ? "border-slate-300/30 bg-slate-500/10 text-slate-100" : "border-white/15 bg-black/20 text-gray-300"}`}>
              <div className="flex items-center justify-between gap-3">
                <strong>{skill.name}</strong>
                {skill.unlocked ? (
                  <button
                    type="button"
                    onClick={() => onToggleSkill?.(skill.id)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${(skillEnabledMap?.[skill.id] ?? true)
                      ? "border-slate-200/70 bg-slate-300/20 text-slate-50"
                      : "border-white/25 bg-black/20 text-gray-200"
                      }`}
                  >
                    {(skillEnabledMap?.[skill.id] ?? true) ? "켜짐" : "꺼짐"}
                  </button>
                ) : (
                  <span>{skill.requirement}</span>
                )}
              </div>
              <p className="mt-1 opacity-80">{skill.effect}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
