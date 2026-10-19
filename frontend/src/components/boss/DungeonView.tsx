import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { StageCharacter } from "../workout/LiftStage";
import DungeonStage from "./DungeonStage";
import SkillPlates from "./SkillPlates";
import TimingGauge from "./TimingGauge";
import { barbellLoad } from "../../lib/liftMotion";
import { friendlyError } from "../../lib/httpError";
import { toast } from "../../lib/toast";
import { SKILL_META, allEmpty, type ShadowGrade, type ShadowHit, type ShadowSkill, type ShadowStatus } from "../../lib/shadow";

// 던전 화면의 흐름(docs/design/shadow-dungeon.md 5.2): 기술 원판 탭 → 힘주는 자세 + 타이밍 게이지 0.8초 → 탭 → strike → 연출 → 다음 기술.
// 서버 응답만 믿는다(통 · 토큰 · 체력은 strike 응답으로 갱신). strike 는 밖에서 받는다 — 실제 화면은 API, /dev/dungeon 은 로컬 셈.

type Props = {
  status: ShadowStatus;
  character: StageCharacter | null;
  mbti?: string | null;
  strike: (skill: ShadowSkill, grade: ShadowGrade, crit: boolean) => Promise<ShadowHit>;
  onExit: () => void;
  /** 개발 화면: 다시 시작 버튼 */
  onReset?: () => void;
};

export default function DungeonView({ status, character, mbti, strike, onExit, onReset }: Props) {
  const [view, setView] = useState<ShadowStatus>(status);
  const [picked, setPicked] = useState<ShadowSkill | null>(null);
  const [runKey, setRunKey] = useState<number | null>(null);
  const [hit, setHit] = useState<ShadowHit | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [critArmed, setCritArmed] = useState(false);
  const [lastHit, setLastHit] = useState<ShadowHit | null>(null);
  const [entering] = useState(() => !status.killed);
  const runCount = useRef(0);

  const plates = useMemo(() => barbellLoad(Math.max(40, Math.min(140, Math.round(view.stats.strengthKg / 3 / 5) * 5))).pixel, [view.stats.strengthKg]);
  const spent = allEmpty(view.charge);

  const pick = (skill: ShadowSkill) => {
    if (busy) return;
    const meta = SKILL_META[skill];
    if ((view.charge[skill] ?? 0) <= 0) {
      toast(`이번 주 ${meta.pool} 운동으로 모은 힘이 없어요. ${meta.hint}`, "info");
      return;
    }
    setHit(null);
    setPicked(skill);
    runCount.current += 1;
    setRunKey(runCount.current);
  };

  const onGauge = (grade: ShadowGrade) => {
    if (!picked || busy) return;
    setBusy(true);
    const useCrit = critArmed && view.critTokens > 0;
    strike(picked, grade, useCrit)
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
    setView((v) => ({
      ...v,
      charge: h.chargeLeft ?? v.charge,
      chargeTotal: h.chargeLeft ? Object.values(h.chargeLeft).reduce((a, b) => a + b, 0) : v.chargeTotal,
      critTokens: h.critTokensLeft ?? v.critTokens,
      damage: v.damage + h.damage,
      remaining: h.hpAfter,
      killed: v.killed || h.killed,
      overkillPct: h.overkillPct,
      hits: [...v.hits, h],
    }));
    setLastHit(h);
    setBusy(false);
    setPicked(null);
  }, []);

  const stageDown = view.killed && (hit === null || lastHit?.id === hit.id) && !busy;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-steel-950 text-white" role="dialog" aria-label="그림자 던전">
      <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col gap-3 px-3 pb-6 pt-3">
        <header className="flex items-center justify-between gap-2">
          <button type="button" onClick={onExit} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm" aria-label="던전에서 나가기">
            ←
          </button>
          <div className="text-center">
            <p className="font-num text-[11px] uppercase tracking-[0.2em] text-steel-400">Shadow dungeon</p>
            <h1 className="font-display text-2xl leading-none text-white">{view.name}</h1>
          </div>
          <span className="dg-chip font-num text-sm">Lv {view.level}</span>
        </header>

        <DungeonStage
          character={character}
          mbti={mbti}
          hp={view.hp}
          remaining={view.remaining}
          hit={hit}
          playKey={playKey}
          windup={runKey !== null ? picked : busy ? picked : null}
          down={stageDown}
          entering={entering}
          plates={plates}
          onDone={onDone}
        />

        {/* 능력치 · 패시브 */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
          <span className="dg-chip">
            힘 <b className="font-num text-sm text-white">{view.stats.strengthKg.toLocaleString()}</b>kg
          </span>
          <span className="dg-chip">
            지구력 <b className="font-num text-sm text-white">{view.stats.enduranceKm}</b>km
          </span>
          <span className="dg-chip">
            끈기 <b className="font-num text-sm text-white">{view.stats.attendanceStreak}</b>일 · <b className="font-num text-sm text-white">{view.stats.weeklyStreak}</b>주
          </span>
          {view.passives.map((p) => (
            <span key={p} className="dg-chip border-plate-yellow/70 text-plate-yellow">
              {p}
            </span>
          ))}
        </div>

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

        {view.rest && <p className="text-center text-xs text-steel-400">이번 주는 쉬는 주 — 힘은 들어가지만 처치되지 않고, 연속도 끊기지 않아요.</p>}

        {/* 전리품 */}
        {!busy && lastHit?.killed && lastHit.reward && (
          <div key={`loot-${lastHit.id}`} className="dg-steel dg-pop space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl text-plate-yellow">그림자 처치!</h2>
              {lastHit.overkillPct > 0 && <span className="font-num text-sm text-steel-300">오버킬 {lastHit.overkillPct}%</span>}
            </div>
            <ul className="grid grid-cols-3 gap-2 text-center">
              <li className="dg-well p-2">
                <span className="block font-num text-2xl text-white">+{lastHit.reward.points}</span>
                <span className="text-xs text-steel-400">캐릭터 점수</span>
              </li>
              <li className="dg-well p-2">
                <span className="block font-num text-2xl text-white">{lastHit.reward.box}</span>
                <span className="text-xs text-steel-400">보상 상자</span>
              </li>
              <li className="dg-well p-2">
                <span className="block font-num text-2xl text-white">{lastHit.reward.titles.length}</span>
                <span className="text-xs text-steel-400">새 칭호</span>
              </li>
            </ul>
            {lastHit.reward.titles.length > 0 && (
              <p className="text-sm text-steel-200">
                칭호 <strong className="text-plate-yellow">{lastHit.reward.titles.join(" · ")}</strong>를 얻었어요. 도감에서 달 수 있어요.
              </p>
            )}
            {!onReset && (
              <div className="flex gap-2">
                <Link to="/collection" className="dg-btn dg-btn-primary min-h-[40px] flex-1 text-sm">
                  상자 열기
                </Link>
                <Link to="/shadow" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                  이번 주 전적
                </Link>
              </div>
            )}
          </div>
        )}
        {!busy && view.killed && !(lastHit?.killed && lastHit.reward) && (
          <p className="text-center text-sm text-steel-300">
            이미 쓰러진 그림자예요{view.overkillPct > 0 ? ` · 오버킬 ${view.overkillPct}%` : ""}. 남은 힘은 오버킬로 들어가요.
          </p>
        )}

        {/* 통이 전부 비었을 때 */}
        {!busy && spent && (
          <div className="dg-well space-y-3 p-4 text-center">
            <p className="font-display text-lg text-white">{view.hits.length > 0 ? "모은 힘을 다 썼어요" : "아직 모은 힘이 없어요"}</p>
            <p className="text-sm text-steel-300">운동이나 러닝을 저장하면 그 힘이 통에 쌓여요. 하루 300까지.</p>
            {onReset ? (
              <button type="button" className="dg-btn dg-btn-steel min-h-[40px] w-full text-sm" onClick={onReset}>
                다시
              </button>
            ) : (
              <div className="flex gap-2">
                <Link to="/workout/session" className="dg-btn dg-btn-primary min-h-[40px] flex-1 text-sm">
                  운동 시작
                </Link>
                <Link to="/run" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                  러닝 시작
                </Link>
                <Link to="/" className="dg-btn dg-btn-steel min-h-[40px] flex-1 text-sm">
                  홈
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
