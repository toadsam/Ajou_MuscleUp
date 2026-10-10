import { useEffect, useState } from "react";
import AvatarRenderer from "./avatar/AvatarRenderer";
import TierUpAnimation, { ChalkPuff } from "./avatar/TierUpAnimation";
import type { CharacterTier, GrowthParams } from "./avatar/types";
import type { AvatarCustomization } from "../utils/avatarCustomization";
import type { EvolutionBranch, SkillUnlock } from "../utils/evolutionProgress";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";

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
  gender?: "MALE" | "FEMALE" | null;
  mbti?: string | null;
  isResting?: boolean;
  attendanceRisk?: "normal" | "warning" | "critical";
  change?: ChangeState | null;
  customization?: AvatarCustomization | null;
  rerollBurstNonce?: number;
  evolutionBranch?: EvolutionBranch | null;
  unlockedSkills?: SkillUnlock[];
  skillEnabledMap?: Record<string, boolean>;
  onToggleSkill?: (skillId: string) => void;
};

// 종합 점수 게이지 칸 수(칸 하나 = 5점)
const GAUGE_CELLS = 20;

const decimalsOf = (value: number) => {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : Math.min(2, text.length - dot - 1);
};

// 처음 보일 때 0 에서 값까지 굴러 올라가는 숫자
function RollingNumber({ value, start }: { value: number; start: boolean }) {
  const current = useCountUp(value, { duration: 900, start });
  return <>{current.toFixed(decimalsOf(value))}</>;
}

function StatWell({
  label,
  sub,
  value,
  unit,
  extra,
  start,
  delay,
}: {
  label: string;
  sub: string;
  value: number;
  unit?: string;
  extra?: string;
  start: boolean;
  delay: number;
}) {
  return (
    <div className="dg-well dg-rise p-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-steel-300">{label}</span>
        <span className="font-num text-[11px] tracking-wide text-steel-500">{sub}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-num text-3xl leading-none text-chalk">
          <RollingNumber value={value} start={start} />
        </span>
        {unit && <span className="text-xs text-steel-400">{unit}</span>}
        {extra && <span className="ml-auto text-xs text-plate-yellow">{extra}</span>}
      </div>
    </div>
  );
}

export default function CharacterCard({
  character,
  evaluation,
  gender,
  mbti,
  isResting = false,
  attendanceRisk = "normal",
  change,
  customization,
  rerollBurstNonce = 0,
  evolutionBranch,
  unlockedSkills = [],
  skillEnabledMap,
  onToggleSkill,
}: Props) {
  const popClass = change?.evolved || change?.leveledUp ? "dg-pop" : "";
  const tierBadgeClass = change?.tierChanged ? "dg-plate-in" : "";
  const [rerollFx, setRerollFx] = useState(false);
  const [cardRef, inView] = useInView<HTMLDivElement>();

  useEffect(() => {
    if (!rerollBurstNonce) return;
    setRerollFx(true);
    const timer = window.setTimeout(() => setRerollFx(false), 1400);
    return () => window.clearTimeout(timer);
  }, [rerollBurstNonce]);

  const activeSkillIds = unlockedSkills
    .filter((skill) => skill.unlocked && (skillEnabledMap?.[skill.id] ?? true))
    .map((skill) => skill.id);

  const totalScore = evaluation?.totalScore ?? 0;
  const shownScore = useCountUp(Math.min(totalScore, 100), { duration: 1000, start: inView });
  const litCells = Math.round((Math.min(Math.max(totalScore, 0), 100) / 100) * GAUGE_CELLS);

  return (
    <div ref={cardRef} className={`dg-steel space-y-5 p-5 md:p-6 ${popClass}`}>
      <div className="flex flex-col items-stretch gap-5 md:flex-row">
        {/* 왼쪽: 고무 매트 위 메이플 플랫폼에 선 캐릭터 */}
        <div
          key={rerollBurstNonce}
          className={`dg-rubber relative mx-auto flex h-[232px] w-full max-w-[220px] shrink-0 items-end justify-center overflow-hidden rounded-lg border-[3px] border-black md:mx-0 md:w-[200px] ${
            rerollFx ? "dg-pop" : ""
          }`}
        >
          <div aria-hidden="true" className="dg-platform absolute inset-x-0 bottom-0 h-9" />
          {/* 발이 플랫폼 윗면에 딱 닿도록 (플랫폼 h-9 = 36px) */}
          <div className="relative z-[1] mb-8">
            <TierUpAnimation active={Boolean(change?.tierChanged)} tier={character.tier}>
              <AvatarRenderer
                avatarSeed={character.avatarSeed}
                growthParams={character.growthParams}
                tier={character.tier}
                stage={character.evolutionStage}
                gender={gender}
                mbti={mbti}
                isResting={isResting}
                attendanceRisk={attendanceRisk}
                size={156}
                customization={customization}
                evolutionBranch={evolutionBranch}
                unlockedSkillCount={activeSkillIds.length}
                activeSkillIds={activeSkillIds}
              />
            </TierUpAnimation>
          </div>
          {rerollFx && <ChalkPuff count={20} spread={90} y="72%" />}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-4">
            {/* 티어 = 노란 원판 배지 */}
            <div
              className={`relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-[3px] border-black bg-plate-yellow text-black shadow-md ${tierBadgeClass}`}
              aria-label={`티어 ${character.tier}`}
            >
              <span aria-hidden="true" className="absolute inset-[5px] rounded-full border-2 border-black/25" />
              <span aria-hidden="true" className="absolute left-1/2 top-[9px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-black bg-steel-800" />
              <span className="relative mt-3 max-w-[64px] break-all text-center font-num text-[13px] font-extrabold leading-none tracking-wide">
                {character.tier}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-2xl leading-tight text-chalk">{character.title}</h3>
              <p className="mt-1 text-xs text-steel-400">
                스타일 <span className="font-num text-sm text-steel-300">{character.stylePreset}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="dg-well px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-steel-300">진화 단계</span>
                <span className="font-num text-[11px] tracking-wide text-steel-500">STAGE</span>
              </div>
              <p className="font-num text-4xl leading-none text-chalk">{character.evolutionStage}</p>
            </div>
            <div className="dg-well px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-steel-300">레벨</span>
                <span className="font-num text-[11px] tracking-wide text-steel-500">LV</span>
              </div>
              <p className="font-num text-4xl leading-none text-plate-yellow">{character.level}</p>
            </div>
          </div>

          {evolutionBranch && (
            <span className="dg-chip bg-steel-700 text-chalk">
              <span className="text-steel-400">진화 갈래</span>&nbsp;{evolutionBranch}
            </span>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-steel-300">
                종합 점수 <span className="font-num text-[11px] tracking-wide text-steel-500">TOTAL</span>
              </span>
              <span className="font-num text-xl text-chalk">
                {Math.round(shownScore)}
                <span className="text-sm text-steel-400">/100</span>
              </span>
            </div>
            {/* 칸 게이지: 처음 보일 때 왼쪽부터 한 칸씩 켜진다 */}
            <div
              className="flex h-4 gap-[3px] rounded border-2 border-black bg-steel-950 p-[2px]"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={totalScore}
              aria-label="종합 점수"
            >
              {Array.from({ length: GAUGE_CELLS }, (_, i) => {
                const lit = inView && i < litCells;
                return (
                  <span
                    key={i}
                    className={`flex-1 rounded-[1px] transition-colors duration-150 ${lit ? "bg-plate-yellow" : "bg-steel-800"}`}
                    style={{ transitionDelay: lit ? `${i * 45}ms` : "0ms" }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {evaluation && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <StatWell label="3대 합계" sub="3-LIFT" value={evaluation.threeLiftTotal} unit="kg" start={inView} delay={0} />
          <StatWell label="근력비" sub="RATIO" value={evaluation.strengthRatio} start={inView} delay={50} />
          <div className="dg-well dg-rise p-3" style={{ animationDelay: "100ms" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-steel-300">티어</span>
              <span className="font-num text-[11px] tracking-wide text-steel-500">TIER</span>
            </div>
            <p className="mt-1 font-num text-3xl leading-none text-plate-yellow">{evaluation.tier}</p>
          </div>
          {evaluation.bmi !== undefined && (
            <StatWell
              label="BMI · 키 대비 체중"
              sub="BMI"
              value={evaluation.bmi}
              extra={`${evaluation.heightWeightScore ?? 0}점`}
              start={inView}
              delay={150}
            />
          )}
          {evaluation.skeletalMuscleIndex !== undefined && (
            <StatWell
              label="SMI · 키 대비 근육"
              sub="SMI"
              value={evaluation.skeletalMuscleIndex}
              extra={`${evaluation.heightMuscleScore ?? 0}점`}
              start={inView}
              delay={200}
            />
          )}
        </div>
      )}

      {unlockedSkills.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {unlockedSkills.map((skill, idx) => {
            const enabled = skillEnabledMap?.[skill.id] ?? true;
            return (
              <div
                key={skill.id}
                className={`dg-well dg-rise relative overflow-hidden p-3 pl-4 text-xs ${skill.unlocked ? "text-chalk" : "text-steel-400"}`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${skill.unlocked ? (enabled ? "bg-plate-yellow" : "bg-steel-500") : "bg-steel-700"}`}
                />
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm">{skill.name}</strong>
                  {skill.unlocked ? (
                    <button
                      type="button"
                      onClick={() => onToggleSkill?.(skill.id)}
                      aria-pressed={enabled}
                      className={`rounded border-2 border-black px-2 py-0.5 text-[11px] font-bold shadow-[0_2px_0_#0E0E10] transition active:translate-y-0.5 active:shadow-none ${
                        enabled ? "bg-plate-green text-white" : "bg-steel-700 text-steel-300"
                      }`}
                    >
                      {enabled ? "켜짐" : "꺼짐"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-steel-400">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                      {skill.requirement}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-steel-300">{skill.effect}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
