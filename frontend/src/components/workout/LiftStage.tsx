import { useCallback, useEffect, useRef, useState } from "react";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { CharacterTier, GrowthParams } from "../avatar/types";
import Barbell from "../gym/Barbell";
import { BAR_KG } from "../gym/plates";
import { spawnChalk } from "../../lib/chalkBurst";
import { formatKg, type LiftExerciseInfo } from "../../lib/lifts";
import { barbellLoad, motionFor } from "../../lib/liftMotion";

// 운동 세션 위쪽 "같이 운동하는 캐릭터".
// - 지금 종목의 동작을 두 프레임으로 천천히 반복하고, 세트를 체크하면 빠르게 두 번 들고 초크 가루가 튄다.
// - 바벨 종목은 적은 무게대로 원판을 끼운다(캐릭터 그림 + 아래 바벨). 개인 최고를 넘으면 "PR!".
// - 휴식 중에는 수건을 걸치고 숨을 고른다. 움직임 줄이기 설정이면 멈춘 그림만.

export type StageCharacter = {
  avatarSeed: string;
  tier: CharacterTier;
  evolutionStage: number;
  growthParams?: GrowthParams | null;
  gender?: "MALE" | "FEMALE" | null;
  /** 몸 단계 0~5(서버 BodyStage) */
  bodyStage?: number | null;
};

/** 세트 체크 신호 — id 가 바뀔 때마다 한 번 연출 */
export type StageCue = { id: number; kind: "set" | "pr" | "first" };

type Props = {
  character: StageCharacter | null;
  mbti?: string | null;
  info: LiftExerciseInfo | null;
  weightKg: number;
  reps: number;
  resting: boolean;
  cue: StageCue | null;
};

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

const CUE_TEXT: Record<StageCue["kind"], string> = { set: "+1 세트", pr: "PR!", first: "첫 기록" };

export default function LiftStage({ character, mbti, info, weightKg, reps, resting, cue }: Props) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [shown, setShown] = useState<StageCue | null>(null);
  const timers = useRef<number[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const reduce = useRef(prefersReducedMotion()).current;

  // 세트 체크 연출(빠른 반복 · 글자)이 끝난 뒤에 휴식 자세로
  const restingNow = resting && !shown;
  const motion = motionFor(info);
  const isBarbell = motion.equip === "barbell";
  const load = isBarbell ? barbellLoad(weightKg) : null;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /** reps 번 들어 올린다(half: 한 번 내려가거나 올라가는 데 걸리는 시간) */
  const play = useCallback((count: number, half: number) => {
    clearTimers();
    for (let i = 0; i < count; i += 1) {
      timers.current.push(window.setTimeout(() => setFrame(1), i * 2 * half));
      timers.current.push(window.setTimeout(() => setFrame(0), (i * 2 + 1) * half));
    }
  }, []);

  useEffect(() => clearTimers, []);

  // 평소: 몇 초마다 천천히 한 번
  useEffect(() => {
    if (reduce || restingNow || !info) return;
    const t = window.setInterval(() => play(1, 700), 3600);
    return () => window.clearInterval(t);
  }, [reduce, restingNow, info, play]);

  // 세트 체크: 빠르게 두 번 + 초크 가루 + 글자
  useEffect(() => {
    if (!cue) return;
    setShown(cue);
    if (!reduce) {
      play(2, 240);
      const box = boxRef.current?.getBoundingClientRect();
      if (box) spawnChalk(box.left + box.width / 2, box.top + box.height * 0.35);
    }
    const t = window.setTimeout(() => setShown(null), cue.kind === "set" ? 1100 : 2200);
    return () => window.clearTimeout(t);
  }, [cue, reduce, play]);

  const action = info ? { kind: motion.kind, frame, equip: motion.equip, plates: load?.pixel ?? [] } : null;

  let weightText = "";
  if (info) {
    if (info.bodyweight) weightText = weightKg > 0 ? `맨몸 +${formatKg(weightKg)}kg` : "맨몸";
    else if (motion.equip === "dumbbell") weightText = weightKg > 0 ? `덤벨 ${formatKg(weightKg)}kg` : "";
    else weightText = weightKg > 0 ? `${formatKg(weightKg)}kg` : "";
  }
  let plateText = "";
  if (load && weightKg > 0) {
    if (weightKg < BAR_KG) plateText = `바(${BAR_KG}kg)보다 가벼워요`;
    else if (load.side.length === 0) plateText = `빈 바 ${BAR_KG}kg`;
    else plateText = `한쪽 ${load.side.map((p) => formatKg(p.kg)).join(" · ")}`;
    if (load.rest > 0) plateText += ` (+${formatKg(load.rest)}kg는 원판으로 못 맞춰요)`;
  }

  return (
    <div className="flex items-stretch gap-3">
      <div
        ref={boxRef}
        className={`dg-well relative flex h-[112px] w-[118px] flex-none items-end justify-center overflow-hidden pb-1 ${
          shown?.kind === "pr" && !reduce ? "lift-stage-pr" : ""
        }`}
      >
        {character ? (
          <AvatarRenderer
            avatarSeed={character.avatarSeed}
            tier={character.tier}
            stage={character.evolutionStage}
            growthParams={character.growthParams}
            bodyStage={character.bodyStage}
            gender={character.gender}
            mbti={mbti}
            isResting={restingNow}
            size={74}
            action={action}
          />
        ) : (
          <span className="self-center text-xs text-steel-500">캐릭터 불러오는 중</span>
        )}
        {shown && (
          <span
            key={shown.id}
            className={`dg-pop pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 -rotate-3 whitespace-nowrap rounded border-2 border-steel-950 px-1.5 font-num leading-tight ${
              shown.kind === "set" ? "bg-plate-green text-sm text-white" : "bg-plate-yellow text-lg text-steel-950"
            }`}
          >
            {CUE_TEXT[shown.kind]}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-display text-lg leading-tight">{info ? info.label : "종목을 넣어 주세요"}</p>
        <p className="text-xs text-steel-400">
          {restingNow ? "숨 고르는 중" : info ? (reps > 0 ? `이번 세트 ${weightText ? `${weightText} × ` : ""}${reps}회` : weightText || "무게 · 횟수를 적어 주세요") : "캐릭터가 같이 운동해요"}
        </p>
        {load && weightKg >= BAR_KG && (
          <div className="overflow-hidden">
            <Barbell
              plateList={load.side.slice(0, 8)}
              height={40}
              animate={!reduce}
              label={`${formatKg(weightKg)}kg 바벨, ${plateText}`}
            />
          </div>
        )}
        {plateText && <p className="truncate text-[11px] text-steel-400">{plateText}</p>}
      </div>
    </div>
  );
}
