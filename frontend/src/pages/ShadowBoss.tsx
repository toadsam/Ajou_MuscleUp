import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import BossFight, { type FightMotion } from "../components/boss/BossFight";
import HpBar from "../components/boss/HpBar";
import ShadowSprite from "../components/boss/ShadowSprite";
import { PlateIcon } from "../components/boss/SkillPlates";
import type { StageCharacter } from "../components/workout/LiftStage";
import { api } from "../lib/api";
import { friendlyError } from "../lib/httpError";
import {
  DUNGEON_PATH,
  SHADOW_DAILY_CAP,
  SHADOW_HISTORY_PATH,
  SHADOW_PATH,
  SKILLS,
  SKILL_META,
  SOURCE_LABEL,
  STRIKE_CHUNK,
  recentWeekStarts,
  shortDate,
  type ShadowHistoryItem,
  type ShadowHit,
  type ShadowStatus,
} from "../lib/shadow";

// 그림자 화면(/shadow, docs/design/shadow-boss.md 5.4 · shadow-dungeon.md 5.5).
// 위: 모은 힘(통 5개) + 던전 들어가기 → 마지막 타 다시 보기(없으면 마주 선 둘). 가운데: 이번 주 타 목록. 아래: 최근 8주 전적(원판 줄) + 규칙.

const HISTORY_WEEKS = 8;

/** 다시 볼 때 쓰는 동작 — 던전 타는 그 기술, 1차 공격 · 자동 정산은 출처로(세션 스쿼트 · 러닝 달리기) */
function replayMotion(hit: ShadowHit): FightMotion {
  if (hit.skill) return { kind: SKILL_META[hit.skill].kind, equip: SKILL_META[hit.skill].equip };
  return hit.source === "RUN" ? { kind: "run", equip: "none" } : { kind: "squat", equip: "barbell" };
}

/** 타 한 줄의 이름: 기술이면 기술 이름, 아니면 출처 */
function hitLabel(hit: ShadowHit) {
  if (hit.skill) return `${SKILL_META[hit.skill].label}${hit.source === "SETTLE" ? " (자동)" : ""}`;
  return SOURCE_LABEL[hit.source];
}

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
            <BossFight hit={lastHit} character={character} mbti={mbti} motion={replayMotion(lastHit)} replayKey={replayKey} noLinks />
            <div className="flex items-center justify-between text-xs text-steel-400">
              <span>마지막 타 {shortDate(lastHit.hitOn)} · {hitLabel(lastHit)}</span>
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
            <p className="mt-3 text-sm text-steel-300">아직 때린 적이 없어요. 운동이나 러닝을 저장하면 힘이 통에 쌓이고, 던전에서 기술로 쏴요.</p>
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

        {status && (
          <div className="dg-steel space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">모은 힘</h2>
              <span className="font-num text-sm text-steel-300">
                통 {status.chargeTotal.toLocaleString()} · 치명타 토큰 {status.critTokens}
              </span>
            </div>
            <ul className="grid grid-cols-5 gap-1">
              {SKILLS.map((s) => {
                const left = status.charge[s] ?? 0;
                return (
                  <li key={s} className="flex flex-col items-center gap-1 text-center" aria-label={`${SKILL_META[s].label} ${left}`}>
                    <PlateIcon skill={s} size={40} empty={left <= 0} />
                    <span className={`font-num text-base leading-none ${left <= 0 ? "text-steel-500" : "text-white"}`}>{left}</span>
                    <span className="text-[11px] leading-none text-steel-400">{SKILL_META[s].label}</span>
                  </li>
                );
              })}
            </ul>
            {status.passives.length > 0 && (
              <p className="flex flex-wrap gap-1 text-xs">
                {status.passives.map((p) => (
                  <span key={p} className="dg-chip border-plate-yellow/70 text-plate-yellow">
                    {p}
                  </span>
                ))}
              </p>
            )}
            <Link to={DUNGEON_PATH} className={`dg-btn min-h-[44px] w-full text-sm ${status.chargeTotal > 0 ? "dg-btn-primary" : "dg-btn-steel"}`}>
              {status.chargeTotal > 0 ? "던전 들어가기 →" : "던전 둘러보기"}
            </Link>
            <p className="text-xs text-steel-500">한 번 누르면 통에서 {STRIKE_CHUNK}씩. 안 쓴 힘은 월요일 새벽에 자동으로 들어가요.</p>
          </div>
        )}

        {status && !status.rest && (
          <div className="dg-steel space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">이번 주 타 {status.hits.length}번</h2>
              <span className="font-num text-sm text-steel-300">
                {status.killed ? `처치 · 오버킬 ${status.overkillPct}%` : `${status.remaining.toLocaleString()} 남음`}
              </span>
            </div>
            {status.hits.length === 0 ? (
              <p className="text-sm text-steel-400">첫 타를 기다리고 있어요.</p>
            ) : (
              <ul className="divide-y divide-steel-700/70 text-sm">
                {status.hits.map((h, i) => (
                  <li key={h.id} className="flex items-center gap-3 py-2">
                    <span className="w-16 flex-none font-num text-steel-400">{shortDate(h.hitOn)}</span>
                    <span className="flex-none text-steel-200">{hitLabel(h)}</span>
                    <span className="flex-1 truncate text-xs text-steel-500">
                      {h.damage === 0 && h.raw > 0 ? `오늘 상한 ${SHADOW_DAILY_CAP} 초과` : h.bonus > 0 ? `힘 ${h.raw} + 보너스 ${h.bonus}` : h.crit ? `힘 ${h.raw} → ${h.damage}` : ""}
                    </span>
                    {h.grade === "PERFECT" && <span className="dg-chip flex-none font-num text-[11px] text-plate-yellow">PERFECT</span>}
                    {h.crit && <span className="dg-chip flex-none text-[11px] text-plate-yellow">치명타</span>}
                    {h.killed && <span className="dg-chip flex-none text-[11px] text-plate-red">처치</span>}
                    <span className={`w-14 flex-none text-right font-num text-lg ${h.damage === 0 ? "text-steel-500" : "text-white"}`}>
                      {h.damage > 0 ? `+${h.damage}` : "0"}
                      <span className="sr-only">{i === status.hits.length - 1 ? " (마지막 타)" : ""}</span>
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
            힘 1이에요. 하루에 모을 수 있는 힘은 {SHADOW_DAILY_CAP}까지.
          </p>
          <p>
            힘은 종목에 따라 다섯 통(하체 · 가슴 · 등 · 어깨팔코어 · 러닝)에 쌓이고, 던전에서 그 통의 기술로 쏴요. 한 번에 {STRIKE_CHUNK}씩, 타이밍이 맞으면 최대 5%,
            삼대장 · 장거리 · 꾸준함 같은 패시브로 합쳐서 15%까지 더 들어가요. 개인 최고나 러닝 기록을 깨면 치명타 토큰 — 내가 고른 타에 1.5배와 레벨당 1%.
          </p>
          <p>월요일마다 새 그림자가 서요. 처치하면 캐릭터 점수 +10, 보상 상자 1개, 그리고 칭호. 쉬는 주에는 잠들어 있어 연속이 끊기지 않아요.</p>
        </div>
      </div>
    </section>
  );
}
