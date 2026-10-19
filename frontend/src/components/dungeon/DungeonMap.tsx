import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { StageCharacter } from "../workout/LiftStage";
import DungeonStage from "../boss/DungeonStage";
import SkillPlates, { PlateIcon } from "../boss/SkillPlates";
import TimingGauge from "../boss/TimingGauge";
import ShadowShareEditor from "../boss/ShadowShareEditor";
import Joystick from "./Joystick";
import { createDungeon, type DungeonController, type EncounterTarget } from "./dungeonWorld";
import { barbellLoad } from "../../lib/liftMotion";
import { friendlyError } from "../../lib/httpError";
import { toast } from "../../lib/toast";
import { SKILLS, SKILL_META, type ShadowGrade, type ShadowHit, type ShadowMob, type ShadowSkill, type ShadowStatus } from "../../lib/shadow";

// 그림자 던전 지도판(docs/design/shadow-dungeon-map.md) — 걸어 다니는 던전 + 몬스터와 닿으면 전투 창.
// 지도는 dungeonWorld(캔버스), 이 컴포넌트는 HUD(나가기 · 보스 체력 · 통) · 조이스틱 · 전투 창(DungeonStage · TimingGauge · SkillPlates)을 맡는다.
// 숫자는 서버 응답만 믿는다(strike 응답의 chargeLeft · critTokensLeft · hpAfter · mob). strike 는 밖에서 받는다(실제 API / 개발 로컬 셈).

export type StrikeTarget = "BOSS" | number;

type Props = {
  status: ShadowStatus;
  character: StageCharacter | null;
  mbti?: string | null;
  tank?: string | null;
  strike: (target: StrikeTarget, skill: ShadowSkill, grade: ShadowGrade, crit: boolean) => Promise<ShadowHit>;
  onExit: () => void;
  /** 개발 화면: 다시 시작 */
  onReset?: () => void;
};

type Battle = { target: StrikeTarget };

export default function DungeonMap({ status, character, mbti, tank, strike, onExit, onReset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<DungeonController | null>(null);
  const [view, setView] = useState<ShadowStatus>(status);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [atExit, setAtExit] = useState(false);
  const [showPools, setShowPools] = useState(false);
  // 전투 창 안
  const [picked, setPicked] = useState<ShadowSkill | null>(null);
  const [runKey, setRunKey] = useState<number | null>(null);
  const [hit, setHit] = useState<ShadowHit | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [critArmed, setCritArmed] = useState(false);
  const [lastHit, setLastHit] = useState<ShadowHit | null>(null);
  const [sharing, setSharing] = useState(false);
  const runCount = useRef(0);

  const plates = useMemo(() => barbellLoad(Math.max(40, Math.min(140, Math.round(view.stats.strengthKg / 3 / 5) * 5))).pixel, [view.stats.strengthKg]);

  // 지도 만들기(한 번)
  const encounterRef = useRef<(t: EncounterTarget) => void>(() => {});
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const d = createDungeon(c, { mbti, tank }, {
      onEncounter: (t) => encounterRef.current(t),
      onExitZone: setAtExit,
    });
    ctl.current = d;
    if (import.meta.env.DEV) (window as unknown as { __dungeon?: DungeonController }).__dungeon = d;
    return () => {
      d.destroy();
      ctl.current = null;
    };
  }, [mbti, tank]);

  // 지도에 상대 상태 알려 주기
  useEffect(() => {
    ctl.current?.setMobs(view.mobs.map((m) => ({ id: m.id, code: m.code, name: m.name, slot: m.slot, hp: m.hp, remaining: m.remaining, killed: m.killed })));
  }, [view.mobs]);
  useEffect(() => {
    ctl.current?.setBoss({ name: view.name, hp: view.hp, remaining: view.remaining, killed: view.killed, rest: view.rest });
  }, [view.name, view.hp, view.remaining, view.killed, view.rest]);

  encounterRef.current = (t) => {
    ctl.current?.setPaused(true);
    setHit(null);
    setLastHit(null);
    setPicked(null);
    setRunKey(null);
    setCritArmed(false);
    setBattle({ target: t.kind === "boss" ? "BOSS" : t.id });
  };

  const leaveBattle = () => {
    if (busy) return;
    setBattle(null);
    setHit(null);
    setPicked(null);
    setRunKey(null);
    ctl.current?.stepBack();
    ctl.current?.setPaused(false);
  };

  const mob: ShadowMob | null = battle && battle.target !== "BOSS" ? view.mobs.find((m) => m.id === battle.target) ?? null : null;
  const foeHp = mob ? mob.hp : view.hp;
  const foeRemaining = mob ? mob.remaining : view.remaining;
  const foeDown = mob ? mob.killed : view.killed && !view.rest;

  const pick = (skill: ShadowSkill) => {
    if (busy || !battle) return;
    const meta = SKILL_META[skill];
    if ((view.charge[skill] ?? 0) <= 0) {
      toast(`이번 주 ${meta.pool} 운동으로 모은 힘이 없어요. ${meta.hint}`, "info");
      return;
    }
    if (mob?.killed) return;
    setHit(null);
    setPicked(skill);
    runCount.current += 1;
    setRunKey(runCount.current);
  };

  const onGauge = (grade: ShadowGrade) => {
    if (!picked || busy || !battle) return;
    setBusy(true);
    const useCrit = critArmed && view.critTokens > 0;
    strike(battle.target, picked, grade, useCrit)
      .then((h) => {
        setRunKey(null);
        setCritArmed(false);
        setHit(h);
        setPlayKey((k) => k + 1);
      })
      .catch((e: unknown) => {
        toast(friendlyError(e, "기술이 들어가지 않았어요. 다시 눌러 주세요."), "error");
        setBusy(false);
        setPicked(null);
        setRunKey(null);
      });
  };

  const onDone = useCallback((h: ShadowHit) => {
    setView((v) => {
      const charge = h.chargeLeft ?? v.charge;
      const next: ShadowStatus = {
        ...v,
        charge,
        chargeTotal: SKILLS.reduce((a, s) => a + (charge[s] ?? 0), 0),
        critTokens: h.critTokensLeft ?? v.critTokens,
      };
      if (h.mob) {
        next.mobs = v.mobs.map((m) => (m.id === h.mob!.id ? { ...m, remaining: h.hpAfter, killed: m.killed || h.killed } : m));
      } else {
        next.damage = v.damage + h.damage;
        next.remaining = h.hpAfter;
        next.killed = v.killed || h.killed;
        next.overkillPct = h.overkillPct;
        next.hits = [...v.hits, h];
      }
      return next;
    });
    setLastHit(h);
    setBusy(false);
    setPicked(null);
  }, []);

  const aliveMobs = view.mobs.filter((m) => !m.killed).length;
  const foeName = mob ? mob.name : view.name;

  return (
    <div className="fixed inset-0 z-[70] bg-steel-950 text-white" role="dialog" aria-label="그림자 던전">
      <div className="relative mx-auto h-full w-full max-w-[480px]">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="그림자 던전 지도. 조이스틱 · 방향키로 걷고, 바닥을 누르면 그 자리로 가요. 몬스터에 닿으면 전투." />

        {/* 위 HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <button type="button" onClick={onExit} className="dg-btn dg-btn-steel pointer-events-auto min-h-[36px] px-3 text-sm" aria-label="던전에서 나가기">
            ←
          </button>
          <div className="dg-steel pointer-events-auto min-w-0 flex-1 px-2 py-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-display text-sm text-white">{view.name}</span>
              <span className="font-num text-xs text-steel-300">
                {view.killed ? "DOWN" : `${view.remaining.toLocaleString()} / ${view.hp.toLocaleString()}`}
              </span>
            </div>
            <div className="dg-well relative mt-1 h-2 overflow-hidden">
              <span className="absolute inset-y-0 left-0 bg-plate-red" style={{ width: `${Math.max(0, Math.min(100, (view.remaining / Math.max(1, view.hp)) * 100))}%` }} />
            </div>
            <p className="mt-0.5 font-num text-[11px] text-steel-400">잡몹 {aliveMobs}마리 남음 · Lv {view.level}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPools((v) => !v)}
            className="dg-steel pointer-events-auto flex items-center gap-1 px-2 py-1.5"
            aria-expanded={showPools}
            aria-label={`모은 힘 ${view.chargeTotal}, 치명타 토큰 ${view.critTokens}`}
          >
            <span className="flex -space-x-1.5">
              {SKILLS.map((s) => (
                <PlateIcon key={s} skill={s} size={16} empty={(view.charge[s] ?? 0) <= 0} />
              ))}
            </span>
            <span className="font-num text-sm">{view.chargeTotal}</span>
          </button>
        </div>

        {showPools && !battle && (
          <div className="dg-steel dg-pop absolute right-2 top-[74px] w-[220px] space-y-2 p-3 text-xs">
            <ul className="space-y-1">
              {SKILLS.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <PlateIcon skill={s} size={18} empty={(view.charge[s] ?? 0) <= 0} />
                  <span className="flex-1 text-steel-200">
                    {SKILL_META[s].label} <span className="text-steel-500">· {SKILL_META[s].pool}</span>
                  </span>
                  <span className="font-num text-sm text-white">{view.charge[s] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="text-steel-300">
              치명타 토큰 <b className="font-num text-white">{view.critTokens}</b> · 힘 <b className="font-num text-white">{view.stats.strengthKg}</b>kg · 지구력{" "}
              <b className="font-num text-white">{view.stats.enduranceKm}</b>km
            </p>
            {view.passives.length > 0 && (
              <p className="flex flex-wrap gap-1">
                {view.passives.map((p) => (
                  <span key={p} className="dg-chip border-plate-yellow/70 text-plate-yellow">
                    {p}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* 아래: 조이스틱 · 안내 · 출구 */}
        {!battle && (
          <>
            <div className="absolute bottom-4 left-4">
              <Joystick onChange={(x, y) => ctl.current?.setStick(x, y)} />
            </div>
            <p className="pointer-events-none absolute bottom-6 right-4 max-w-[46%] text-right text-[11px] leading-snug text-steel-400">
              {view.chargeTotal > 0 ? "몬스터에 닿으면 전투. 걷는 건 공짜예요." : "모은 힘이 없어요. 둘러보고, 운동하고 다시 와요."}
              <span className="hidden [@media(pointer:fine)]:inline"> 방향키 · WASD 로도 걸어요.</span>
            </p>
            {atExit && (
              <div className="dg-steel dg-rise absolute inset-x-4 bottom-36 flex items-center gap-3 p-3">
                <p className="flex-1 text-sm text-steel-200">출구예요. 던전에서 나갈까요?</p>
                <button type="button" onClick={onExit} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">
                  나가기
                </button>
              </div>
            )}
          </>
        )}

        {sharing && (
          <ShadowShareEditor
            data={{
              weekStart: view.weekStart,
              weekEnd: view.weekEnd,
              hp: view.hp,
              overkillPct: view.overkillPct,
              streakWeeks: Math.max(1, view.streakWeeks + (view.killed && lastHit?.killed && !lastHit.mob ? 1 : 0)),
              mobsKilled: view.mobs.filter((m) => m.killed).length,
            }}
            onClose={() => setSharing(false)}
          />
        )}

        {/* 전투 창 */}
        {battle && (
          <div className="absolute inset-0 flex flex-col justify-end bg-steel-950/70">
            <div className="dg-rise max-h-full space-y-3 overflow-y-auto border-t-[3px] border-steel-950 bg-steel-900 px-3 pb-4 pt-3">
              <header className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-num text-[11px] uppercase tracking-[0.2em] text-steel-400">{mob ? (mob.rare ? "Rare" : "Monster") : "Boss"}</p>
                  <h2 className="truncate font-display text-xl leading-none text-white">{foeName}</h2>
                </div>
                <button type="button" onClick={leaveBattle} disabled={busy} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm disabled:opacity-50">
                  {foeDown ? "지도로" : "물러나기"}
                </button>
              </header>

              <DungeonStage
                character={character}
                mbti={mbti}
                hp={foeHp}
                remaining={foeRemaining}
                hit={hit}
                playKey={playKey}
                windup={runKey !== null || busy ? picked : null}
                down={foeDown && (hit === null || lastHit?.id === hit.id) && !busy}
                plates={plates}
                onDone={onDone}
                foe={mob ? { kind: "mob", code: mob.code } : { kind: "boss" }}
                hpLabel={mob ? `${mob.name} HP` : undefined}
              />

              {/* 결과 */}
              {!busy && lastHit?.mob && lastHit.killed && (
                <div className="dg-steel dg-pop flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="font-display text-base text-plate-yellow">{lastHit.mob.name} 처치!</span>
                  <span className="dg-chip">조각 +{lastHit.mob.shards}</span>
                  {lastHit.mob.firstKill &&
                    (onReset ? (
                      <span className="dg-chip border-plate-yellow/70 text-plate-yellow">도감 카드 첫 등록</span>
                    ) : (
                      <Link to="/collection" className="dg-chip border-plate-yellow/70 text-plate-yellow underline-offset-2 hover:underline">
                        도감 카드 첫 등록 →
                      </Link>
                    ))}
                  {lastHit.mob.refunded > 0 && <span className="dg-chip text-steel-300">남은 힘 {lastHit.mob.refunded} 돌려받음</span>}
                </div>
              )}
              {!busy && lastHit && !lastHit.mob && lastHit.killed && lastHit.reward && (
                <div className="dg-steel dg-pop space-y-2 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-lg text-plate-yellow">그림자 처치!</span>
                    {lastHit.overkillPct > 0 && <span className="font-num text-sm text-steel-300">오버킬 {lastHit.overkillPct}%</span>}
                  </div>
                  <p className="text-sm text-steel-200">
                    캐릭터 점수 +{lastHit.reward.points} · 보상 상자 {lastHit.reward.box}
                    {lastHit.reward.titles.length > 0 && (
                      <>
                        {" "}
                        · 칭호 <strong className="text-plate-yellow">{lastHit.reward.titles.join(" · ")}</strong>
                      </>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSharing(true)} className="dg-btn dg-btn-primary min-h-[40px] flex-1 text-sm">
                      공유 카드
                    </button>
                    {!onReset && (
                      <Link to="/collection" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                        상자 열기
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {!foeDown || (!mob && view.killed) ? (
                <>
                  <TimingGauge runKey={runKey} onResult={onGauge} />
                  <SkillPlates
                    charge={view.charge}
                    disabled={busy}
                    picked={picked}
                    onPick={pick}
                    critTokens={view.critTokens}
                    critArmed={critArmed}
                    onToggleCrit={() => setCritArmed((v) => !v)}
                  />
                  {mob && <p className="text-center text-[11px] text-steel-500">잡몹은 남은 체력만큼만 힘을 써요. 남는 힘은 통으로 돌아와요.</p>}
                  {!mob && view.killed && <p className="text-center text-[11px] text-steel-500">이미 쓰러진 그림자 — 남은 힘은 오버킬로 들어가요.</p>}
                  {!mob && view.rest && <p className="text-center text-[11px] text-steel-500">쉬는 주라 그림자가 잠들어 있어요. 힘은 들어가지만 처치되지 않아요.</p>}
                </>
              ) : null}
              {onReset && view.chargeTotal <= 0 && !busy && (
                <button type="button" className="dg-btn dg-btn-steel min-h-[40px] w-full text-sm" onClick={onReset}>
                  처음부터 다시
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
