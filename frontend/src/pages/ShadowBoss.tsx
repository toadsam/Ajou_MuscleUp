import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import BossFight, { type FightMotion } from "../components/boss/BossFight";
import HpBar from "../components/boss/HpBar";
import ShadowSprite from "../components/boss/ShadowSprite";
import type { StageCharacter } from "../components/workout/LiftStage";
import { api } from "../lib/api";
import { friendlyError } from "../lib/httpError";
import {
  SHADOW_DAILY_CAP,
  SHADOW_HISTORY_PATH,
  SHADOW_PATH,
  SOURCE_LABEL,
  recentWeekStarts,
  shortDate,
  type ShadowHistoryItem,
  type ShadowStatus,
} from "../lib/shadow";

// 그림자 화면(/shadow, docs/design/shadow-boss.md 5.4).
// 위: 마지막 공격 다시 보기(없으면 마주 선 둘). 가운데: 이번 주 공격 목록. 아래: 최근 8주 전적(원판 줄) + 규칙 한 문단.

const HISTORY_WEEKS = 8;

/** 다시 볼 때 쓰는 대표 동작 — 세션은 종목을 모르니 스쿼트, 러닝은 달리기 */
const REPLAY_MOTION: Record<"SESSION" | "RUN", FightMotion> = {
  SESSION: { kind: "squat", equip: "barbell" },
  RUN: { kind: "run", equip: "none" },
};

type WeekMark = { weekStart: string; kind: "killed" | "missed" | "rest" | "none"; damage: number; hp: number };

function marks(status: ShadowStatus, history: ShadowHistoryItem[]): WeekMark[] {
  const byWeek = new Map(history.map((h) => [h.weekStart, h]));
  return recentWeekStarts(status.weekStart, HISTORY_WEEKS).map((ws) => {
    const row = byWeek.get(ws);
    if (!row) return { weekStart: ws, kind: "none", damage: 0, hp: 0 };
    const kind: WeekMark["kind"] = row.killed ? "killed" : row.rest ? "rest" : "missed";
    return { weekStart: ws, kind, damage: row.damage, hp: row.hp };
  });
}

/** 전적 한 주를 원판 하나로: 잡음(빨간 원판) · 놓침(쇠 원판) · 휴식(점선 고리) · 기록 없음(흐린 고리) */
function PlateMark({ mark, current }: { mark: WeekMark; current: boolean }) {
  const label =
    mark.kind === "killed" ? "처치" : mark.kind === "missed" ? (current ? "진행 중" : "놓침") : mark.kind === "rest" ? "휴식" : "기록 없음";
  const circle =
    mark.kind === "killed"
      ? "border-steel-950 bg-plate-red"
      : mark.kind === "missed"
        ? "border-steel-950 bg-steel-600"
        : mark.kind === "rest"
          ? "border-dashed border-steel-400 bg-transparent"
          : "border-dashed border-steel-700 bg-transparent";
  return (
    <li className="flex flex-col items-center gap-1 text-center" aria-label={`${shortDate(mark.weekStart)} 주 ${label}`}>
      <span className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 ${circle} ${current ? "ring-2 ring-plate-yellow ring-offset-2 ring-offset-steel-900" : ""}`}>
        {(mark.kind === "killed" || mark.kind === "missed") && <span className="h-2.5 w-2.5 rounded-full bg-steel-950" aria-hidden="true" />}
      </span>
      <span className="font-num text-[11px] leading-none text-steel-400">{current ? "이번 주" : shortDate(mark.weekStart).split(" ")[0]}</span>
    </li>
  );
}

export default function ShadowBoss() {
  const [status, setStatus] = useState<ShadowStatus | null>(null);
  const [history, setHistory] = useState<ShadowHistoryItem[]>([]);
  const [character, setCharacter] = useState<StageCharacter | null>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      api.get<ShadowStatus>(SHADOW_PATH),
      api.get<ShadowHistoryItem[]>(SHADOW_HISTORY_PATH),
      api.get<StageCharacter>("/api/character/me").catch(() => null),
      api.get<{ mbti?: string | null }>("/api/mypage/stats").catch(() => null),
    ])
      .then(([s, h, c, st]) => {
        if (!alive) return;
        setStatus(s.data);
        setHistory(h.data);
        setCharacter(c?.data ?? null);
        setMbti(st?.data?.mbti ?? null);
      })
      .catch((e: unknown) => alive && setError(friendlyError(e, "그림자를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.")));
    return () => {
      alive = false;
    };
  }, []);

  const lastHit = status && status.hits.length > 0 ? status.hits[status.hits.length - 1] : null;
  const weekMarks = useMemo(() => (status ? marks(status, history) : []), [status, history]);
  const killsIn8 = weekMarks.filter((m) => m.kind === "killed").length;

  if (error) {
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
        <p className="mx-auto max-w-2xl text-sm text-steel-300">{error}</p>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1">
          <p className="font-num text-sm uppercase tracking-[0.2em] text-plate-yellow">Weekly boss</p>
          <h1 className="text-3xl">이번 주 그림자</h1>
          {status && (
            <p className="text-sm text-steel-400">
              {shortDate(status.weekStart)} ~ {shortDate(status.weekEnd)} · 지난 4주의 나보다 5% 세요
              {status.streakWeeks > 0 && <span className="dg-chip ml-2 text-xs text-plate-yellow">{status.streakWeeks}주 연속 처치</span>}
            </p>
          )}
        </header>

        {!status ? (
          <div className="dg-rubber flex h-[200px] items-center justify-center text-sm text-steel-400">
            <span className="dg-loading-plates mr-3" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            그림자를 불러오는 중
          </div>
        ) : status.rest ? (
          <div className="dg-rubber space-y-2 p-5">
            <p className="font-display text-2xl">이번 주는 쉬어요</p>
            <p className="text-sm text-steel-300">
              주간 목표에서 쉬는 주로 정했어요. 그림자가 잠들어 있어 처치되지 않고, 연속 처치도 끊기지 않아요. 운동을 하면 힘은 그대로 쌓여요
              {status.damage > 0 ? ` (지금까지 ${status.damage.toLocaleString()})` : ""}.
            </p>
          </div>
        ) : lastHit ? (
          <div className="space-y-2">
            <BossFight hit={lastHit} character={character} mbti={mbti} motion={REPLAY_MOTION[lastHit.source]} replayKey={replayKey} noLinks />
            <div className="flex items-center justify-between text-xs text-steel-400">
              <span>마지막 공격 {shortDate(lastHit.hitOn)} · {SOURCE_LABEL[lastHit.source]}</span>
              <button type="button" onClick={() => setReplayKey((k) => k + 1)} className="underline underline-offset-4">
                다시 보기
              </button>
            </div>
          </div>
        ) : (
          <div className="dg-rubber p-4">
            <div className="relative flex h-[150px] items-end justify-between px-1">
              <span className="pointer-events-none absolute inset-x-2 bottom-2 border-t-2 border-dashed border-steel-500/70" aria-hidden="true" />
              <div className="relative z-10 flex h-full w-[118px] items-end justify-center">
                {character && (
                  <AvatarRenderer
                    avatarSeed={character.avatarSeed}
                    tier={character.tier}
                    stage={character.evolutionStage}
                    growthParams={character.growthParams}
                    gender={character.gender}
                    mbti={mbti}
                    size={104}
                  />
                )}
              </div>
              <span className="relative z-10 self-center font-num text-2xl text-steel-600">VS</span>
              <div className="relative z-10 flex h-full w-[118px] items-end justify-center">
                <ShadowSprite avatarSeed={character?.avatarSeed ?? "shadow"} female={character?.gender === "FEMALE"} size={104} />
              </div>
            </div>
            <div className="mt-3">
              <HpBar hp={status.hp} value={status.remaining} />
            </div>
            <p className="mt-3 text-sm text-steel-300">아직 공격이 없어요. 운동이나 러닝을 저장하면 그 힘만큼 그림자가 깎여요.</p>
            <div className="mt-3 flex gap-2">
              <Link to="/workout/session" className="dg-btn dg-btn-primary min-h-[40px] flex-1 text-sm">
                운동 시작
              </Link>
              <Link to="/run" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                러닝 시작
              </Link>
            </div>
          </div>
        )}

        {status && !status.rest && (
          <div className="dg-steel space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">이번 주 공격 {status.hits.length}번</h2>
              <span className="font-num text-sm text-steel-300">
                {status.killed ? `처치 · 오버킬 ${status.overkillPct}%` : `${status.remaining.toLocaleString()} 남음`}
              </span>
            </div>
            {status.hits.length === 0 ? (
              <p className="text-sm text-steel-400">첫 공격을 기다리고 있어요.</p>
            ) : (
              <ul className="divide-y divide-steel-700/70 text-sm">
                {status.hits.map((h, i) => (
                  <li key={h.id} className="flex items-center gap-3 py-2">
                    <span className="w-16 flex-none font-num text-steel-400">{shortDate(h.hitOn)}</span>
                    <span className="flex-none text-steel-200">{SOURCE_LABEL[h.source]}</span>
                    <span className="flex-1 truncate text-xs text-steel-500">
                      {h.damage === 0 && h.raw > 0 ? `오늘 상한 ${SHADOW_DAILY_CAP} 초과` : h.crit ? `자기 기록 갱신 · 힘 ${h.raw} → ${h.damage}` : ""}
                    </span>
                    {h.crit && <span className="dg-chip flex-none text-[11px] text-plate-yellow">치명타</span>}
                    {h.killed && <span className="dg-chip flex-none text-[11px] text-plate-red">처치</span>}
                    <span className={`w-14 flex-none text-right font-num text-lg ${h.damage === 0 ? "text-steel-500" : "text-white"}`}>
                      {h.damage > 0 ? `+${h.damage}` : "0"}
                      <span className="sr-only">{i === status.hits.length - 1 ? " (마지막 공격)" : ""}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status && (
          <div className="dg-steel space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">최근 8주</h2>
              <span className="font-num text-sm text-steel-300">처치 {killsIn8}주</span>
            </div>
            <ul className="grid grid-cols-8 gap-1">
              {[...weekMarks].reverse().map((m) => (
                <PlateMark key={m.weekStart} mark={m} current={m.weekStart === status.weekStart} />
              ))}
            </ul>
            <p className="text-xs text-steel-500">빨간 원판 처치 · 쇠 원판 놓침 · 점선 휴식 · 흐린 점선 기록 없음</p>
            {status.lastWeek && (
              <p className="text-sm text-steel-300">
                지난주는 체력 {status.lastWeek.hp.toLocaleString()}에 힘 {status.lastWeek.damage.toLocaleString()}을 넣어{" "}
                {status.lastWeek.killed ? "잡았어요." : status.lastWeek.rest ? "쉬었어요." : "놓쳤어요."}
              </p>
            )}
          </div>
        )}

        <div className="dg-well space-y-2 p-4 text-sm text-steel-300">
          <p className="font-display text-base text-white">그림자는 지난 나예요</p>
          <p>
            체력은 최근 4주 동안 넣은 힘의 평균에 5%를 더한 값(최소 100)이에요. 운동 세션은 볼륨 100kg·회가 힘 1, 맨몸 종목은 한 번을 20kg으로 쳐요. 러닝은 100m가
            힘 1이에요. 하루에 넣을 수 있는 힘은 {SHADOW_DAILY_CAP}까지.
          </p>
          <p>개인 최고나 러닝 기록을 깨면 그 공격은 치명타 — 힘에 1.5배와 레벨당 1%를 더해요. 평소 공격에는 레벨 배율이 없어요. 그림자는 공정한 거울이니까요.</p>
          <p>월요일마다 새 그림자가 서요. 처치하면 캐릭터 점수 +10, 보상 상자 1개, 그리고 칭호. 쉬는 주에는 잠들어 있어 연속이 끊기지 않아요.</p>
        </div>
      </div>
    </section>
  );
}
