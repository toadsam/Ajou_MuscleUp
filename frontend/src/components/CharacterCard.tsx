import AvatarRenderer from "./avatar/AvatarRenderer";
import TierUpAnimation from "./avatar/TierUpAnimation";
import type { CharacterTier, GrowthParams } from "./avatar/types";

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
};

export default function CharacterCard({ character, evaluation, mbti, change }: Props) {
  const glowClass = change?.evolved ? "card-evolution" : change?.leveledUp ? "card-levelup" : "";
  const tierBadgeClass = change?.tierChanged ? "badge-bounce" : "";

  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5 ${glowClass}`}>
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        <TierUpAnimation active={Boolean(change?.tierChanged)} tier={character.tier}>
          <AvatarRenderer
            avatarSeed={character.avatarSeed}
            growthParams={character.growthParams}
            tier={character.tier}
            stage={character.evolutionStage}
            mbti={mbti}
            size={156}
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
        </div>
      )}
    </div>
  );
}
