import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AvatarRenderer from "../avatar/AvatarRenderer";
import type { PixelAction } from "../avatar/pixelAvatar";
import type { StageCharacter } from "../workout/LiftStage";
import { useCountUp } from "../../hooks/useCountUp";
import { spawnChalk } from "../../lib/chalkBurst";
import type { InbodyVerdict as Verdict, VerdictGrade, VerdictStat } from "../../lib/inbodyVerdict";

// 인바디 판정 장면 — 상담 결과가 나온 직후 한 번. 그림자 전투(components/boss/BossFight)와 같은 문법으로:
//   읽기   핵심 4칸(골격근량 · 체지방률 · BMI · 내장지방)이 원판처럼 하나씩 철컥 끼워지며 숫자가 굴러 올라가고,
//          끼워지는 순간 무대가 살짝 흔들리고 "좋음 · 보통 · 다음 목표" 칩이 찍힌다. 내 캐릭터는 칸마다 힘을 준다.
//   판정   네 칸이 다 끼워지면 가운데 "오늘 올린 원판"(5~25kg)이 쾅 떨어지고 초크가 튀며 이름 도장(출발선 ~ 강철)이 찍힌다.
//   보류   읽기 신뢰도가 낮거나 확인이 필요한 수치면 원판을 떨어뜨리지 않고 "숫자 확인부터" 카드만 조용히 올라온다.
// 낮은 판정도 "패배" 연출은 없다(출발선). 건너뛰기는 늘 보인다. 한 동작 ≤600ms, 전체 ≈3초. 소리 없음.

type Props = {
  verdict: Verdict;
  confidence: number;
  character?: StageCharacter | null;
  mbti?: string | null;
  /** 값이 바뀌면 처음부터 다시 본다 */
  replayKey?: number;
  /** 보류 카드의 "숫자 확인하기"를 눌렀을 때(없으면 버튼을 숨긴다) */
  onConfirm?: () => void;
  /** 판정이 끝났을 때(건너뛰기 포함) */
  onDone?: () => void;
};

type Stage = "ready" | "stats" | "verdict" | "done";
const ORDER: Stage[] = ["ready", "stats", "verdict", "done"];

/** 칸 하나가 끼워지는 간격 */
const STAT_MS = 520;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

const STATUS_CHIP: Record<VerdictStat["status"], string> = {
  good: "bg-plate-green text-black",
  mid: "bg-plate-yellow text-black",
  watch: "bg-plate-blue text-white",
  none: "bg-steel-700 text-steel-300",
};

/** 원판 한 장: 바깥 잉크 테두리 · 색 면 · 안쪽 홈 · 가운데 쇠 허브, 위쪽에 kg */
export function GradePlate({ grade, size = 104 }: { grade: VerdictGrade; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#0E0E10" />
      <circle cx="50" cy="50" r="44" fill={grade.color} />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#0E0E10" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="50" r="15" fill="#0E0E10" />
      <circle cx="50" cy="50" r="11" fill="#9A9DA3" />
      <circle cx="50" cy="50" r="5" fill="#55585F" />
      <text x="50" y="27" textAnchor="middle" fill={grade.ink} fontSize="15" fontWeight="800" className="font-num">
        {grade.kg}
        <tspan fontSize="8" dx="1">
          kg
        </tspan>
      </text>
    </svg>
  );
}

function StatTile({ stat, landed, from }: { stat: VerdictStat; landed: boolean; from: string }) {
  const shown = useCountUp(landed ? stat.value : null, { duration: 420, start: landed });
  return (
    <li
      className={`relative min-w-0 rounded border-2 px-3 py-2 ${landed ? "dg-well dg-plate-in" : "border-dashed border-steel-600"}`}
      style={{ "--from": from } as CSSProperties}
      aria-label={`${stat.label} ${stat.value === null ? "미입력" : `${stat.value}${stat.unit}`} ${stat.badge}`}
    >
      <p className="font-num text-[11px] uppercase tracking-widest text-steel-400">{stat.label}</p>
      <p className="mt-0.5 flex items-baseline gap-1 leading-none">
        <span className={`font-num text-3xl ${landed && stat.value !== null ? "text-white" : "text-steel-600"}`} aria-hidden="true">
          {landed && stat.value !== null
            ? shown.toLocaleString("ko-KR", { minimumFractionDigits: stat.decimals, maximumFractionDigits: stat.decimals })
            : "--"}
        </span>
        {stat.unit && <span className="font-num text-sm text-steel-400">{stat.unit}</span>}
      </p>
      {landed && (
        <span
          className={`dg-stamp absolute -right-1 -top-2 inline-block rounded border-2 border-steel-950 px-1.5 py-0.5 font-display text-xs leading-none ${STATUS_CHIP[stat.status]}`}
          style={{ animationDelay: "260ms" }}
        >
          {stat.badge}
        </span>
      )}
    </li>
  );
}

export default function InbodyVerdict({ verdict, confidence, character, mbti, replayKey = 0, onConfirm, onDone }: Props) {
  const reduce = useRef(prefersReducedMotion()).current;
  const total = verdict.stats.length;
  const [stage, setStage] = useState<Stage>(reduce ? "done" : "ready");
  const [landed, setLanded] = useState(reduce ? total : 0);
  const [swing, setSwing] = useState(false);
  const [quake, setQuake] = useState<"soft" | "hard" | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const at = (s: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(s);
  const done = at("done");
  const held = verdict.held;

  // 장면 진행표
  useEffect(() => {
    if (reduce) {
      setStage("done");
      setLanded(total);
      onDoneRef.current?.();
      return;
    }
    setStage("ready");
    setLanded(0);
    setSwing(false);
    setQuake(null);

    const timers: number[] = [];
    const plan = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));

    let t = 180;
    plan(t, () => setStage("stats"));
    for (let i = 0; i < total; i += 1) {
      plan(t, () => {
        setLanded(i + 1);
        setSwing((v) => !v);
        setQuake("soft");
      });
      plan(t + 200, () => setQuake(null));
      t += STAT_MS;
    }
    t += 160;
    plan(t, () => {
      setStage("verdict");
      setSwing(true);
      if (!held) {
        setQuake("hard");
        const box = plateRef.current?.getBoundingClientRect();
        if (box) spawnChalk(box.left + box.width / 2, box.top + box.height * 0.6);
      }
    });
    plan(t + 300, () => setQuake(null));
    t += 620;
    plan(t, () => {
      setStage("done");
      onDoneRef.current?.();
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [replayKey, total, held, reduce]);

  const skip = () => {
    setLanded(total);
    setSwing(true);
    setQuake(null);
    setStage("done");
    onDoneRef.current?.();
  };

  const myAction: PixelAction = useMemo(() => ({ kind: "flex", frame: swing ? 1 : 0, equip: "none", plates: [] }), [swing]);

  const showVerdict = at("verdict");

  return (
    <section
      className={`dg-rubber relative overflow-hidden p-4 ${quake === "hard" ? "dg-quake-hard" : quake === "soft" ? "dg-quake" : ""}`}
      aria-label={`인바디 판정${verdict.grade ? ` — ${verdict.grade.name}, ${verdict.grade.kg}kg 원판` : " — 숫자 확인 필요"}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-num text-xs uppercase tracking-[0.2em] text-steel-400">Body check</p>
          <h2 className="font-display text-2xl leading-none text-white">인바디 판정</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="dg-chip text-xs">신뢰도 {Math.round(confidence)}%</span>
          {!done && (
            <button type="button" onClick={skip} className="text-xs text-steel-400 underline underline-offset-4">
              건너뛰기
            </button>
          )}
        </div>
      </header>

      {/* 무대: 내 캐릭터 + 네 칸 */}
      <div className="mt-3 flex items-end gap-3">
        {character && (
          <div className="relative flex w-[96px] flex-none items-end justify-center self-stretch">
            <span className="pointer-events-none absolute inset-x-1 bottom-1 border-t-2 border-dashed border-steel-500/70" aria-hidden="true" />
            <AvatarRenderer
              avatarSeed={character.avatarSeed}
              tier={character.tier}
              stage={character.evolutionStage}
              growthParams={character.growthParams}
              gender={character.gender}
              mbti={mbti}
              size={92}
              action={myAction}
              pumped={done && !held}
            />
          </div>
        )}
        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-2 pt-2">
          {verdict.stats.map((stat, i) => (
            <StatTile key={`${replayKey}-${stat.key}`} stat={stat} landed={i < landed} from={i % 2 === 0 ? "-36px" : "36px"} />
          ))}
        </ul>
      </div>

      {/* 판정: 원판이 떨어지는 자리 */}
      <div className="dg-steel mt-3 flex items-center gap-4 p-3 pr-4">
        <div ref={plateRef} className="relative grid h-[96px] w-[96px] flex-none place-items-center">
          {showVerdict && verdict.grade ? (
            <div key={`plate-${replayKey}`} className="dg-slam">
              <GradePlate grade={verdict.grade} size={96} />
            </div>
          ) : (
            <span
              className={`block h-[84px] w-[84px] rounded-full border-[3px] border-dashed ${showVerdict ? "border-steel-700" : "border-steel-500"}`}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!showVerdict && (
            <p className="font-num text-sm uppercase tracking-widest text-steel-500">{stage === "ready" ? "준비" : `읽는 중 ${Math.min(landed, total)} / ${total}`}</p>
          )}
          {showVerdict && verdict.grade && (
            <div key={`stamp-${replayKey}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="dg-stamp dg-ink-shadow inline-block border-[3px] border-steel-950 bg-plate-yellow px-2 py-0.5 font-display text-2xl leading-tight text-steel-950"
                  style={{ animationDelay: "120ms", textShadow: "none" }}
                >
                  {verdict.grade.name}
                </span>
                <span className="font-num text-xs uppercase tracking-widest text-steel-400">오늘 올린 원판 {verdict.grade.kg}kg</span>
              </div>
              {verdict.score !== null && (
                <p className="mt-1 font-num text-sm text-steel-300">
                  인바디 점수 <ScoreCount value={verdict.score} /> 점
                </p>
              )}
              <p className="mt-1 text-sm leading-snug text-steel-200">{verdict.grade.line}</p>
            </div>
          )}
          {showVerdict && held && (
            <div key={`hold-${replayKey}`} className="dg-pop">
              <p className="font-display text-lg leading-tight text-chalk">판정 보류</p>
              <p className="mt-1 text-sm leading-snug text-steel-300">{verdict.holdReason}</p>
              {onConfirm && (
                <button type="button" onClick={onConfirm} className="dg-btn dg-btn-steel mt-2 min-h-[36px] px-3 text-sm">
                  숫자 확인하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {done && !held && (
        <p className="mt-2 text-xs text-steel-400">
          판정은 핵심 4칸과 인바디 점수로만 찍어요. 자세한 해석과 4주 계획은 아래에 있어요.
        </p>
      )}
    </section>
  );
}

function ScoreCount({ value }: { value: number }) {
  const shown = useCountUp(value, { duration: 520 });
  return (
    <span className="font-num text-2xl text-white" aria-label={String(value)}>
      <span aria-hidden="true">{Math.round(shown)}</span>
    </span>
  );
}
