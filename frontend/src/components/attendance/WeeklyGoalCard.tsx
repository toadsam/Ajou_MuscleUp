import { useCallback, useEffect, useState } from "react";
import Barbell from "../gym/Barbell";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { friendlyError } from "../../lib/httpError";
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_PATH, type WeeklyGoalStatus } from "../../lib/weeklyGoal";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

type Props = {
  /** 값이 바뀌면 다시 불러온다(출석 저장 뒤) */
  refreshKey?: number;
};

/**
 * 주간 목표 카드 — 이번 주 운동 횟수를 원판으로 끼운다(칸 수 = 목표).
 * 매일 연속 대신 "한 주에 N번"을 몇 주 이어 갔는지 보여 주고, 목표 바꾸기 · 쉬는 주를 여기서 한다.
 */
export default function WeeklyGoalCard({ refreshKey = 0 }: Props) {
  const [status, setStatus] = useState<WeeklyGoalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<WeeklyGoalStatus>(WEEKLY_GOAL_PATH);
      setStatus(res.data);
      setError(null);
    } catch (e: unknown) {
      setError(friendlyError(e, "주간 목표를 불러오지 못했어요."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const setTarget = async (target: number) => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const res = await api.put<WeeklyGoalStatus>(WEEKLY_GOAL_PATH, { target });
      setStatus(res.data);
      setEditing(false);
      toast(
        res.data.target === target ? `이번 주부터 주 ${target}번이 목표예요.` : `다음 주부터 주 ${target}번이 목표예요.`,
        "success",
      );
    } catch (e: unknown) {
      toast(friendlyError(e, "목표를 바꾸지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const setRest = async (rest: boolean) => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const res = await api.put<WeeklyGoalStatus>(`${WEEKLY_GOAL_PATH}/rest`, { rest });
      setStatus(res.data);
      toast(rest ? "이번 주는 쉬는 주예요. 연속 기록은 그대로 남아요." : "쉬는 주를 취소했어요.", "success");
    } catch (e: unknown) {
      toast(friendlyError(e, "바꾸지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="attendance-card dg-steel flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm font-semibold text-red-300">
          {error}
        </p>
        <button type="button" onClick={() => void load()} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
          다시 시도
        </button>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="attendance-card dg-steel" role="status">
        <span className="dg-loading-plates" aria-label="주간 목표 불러오는 중">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }

  const left = Math.max(0, status.target - status.done);
  const message = status.achieved
    ? `이번 주 목표 달성! 보너스 +${status.bonusPoints}${status.rewarded ? " 받음" : ""}`
    : status.rest
      ? "쉬는 주예요. 연속 기록은 끊기지 않아요."
      : `${left}번 더 하면 달성 · 보너스 +${status.bonusPoints}`;
  const pendingNext = status.nextTarget !== status.target;

  return (
    <div className="attendance-card dg-steel weekly-goal-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">주간 목표</h2>
          <p className="mt-1 text-sm text-steel-300">
            주 <strong className="font-num text-white">{status.target}</strong>번 운동
            {pendingNext && <span className="text-steel-400"> · 다음 주부터 {status.nextTarget}번</span>}
          </p>
        </div>
        <span className={`dg-chip ${status.streakWeeks > 0 ? "bg-plate-yellow text-steel-950" : ""}`} aria-label={`${status.streakWeeks}주 연속 달성`}>
          <span className="font-num text-base">{status.streakWeeks}</span>주 연속
        </span>
      </div>

      {/* 넓은 화면에서 바벨 · 요일이 끝없이 늘어나지 않게 */}
      <div className="max-w-md">
        <div className="mt-3">
          <Barbell
            loaded={status.done}
            slots={Math.min(status.target, WEEKLY_GOAL_MAX)}
            height={84}
            label={`이번 주 ${status.done}번 / 목표 ${status.target}번`}
            liftable={status.achieved}
          />
        </div>

        <ol className="mt-3 grid grid-cols-7 gap-1 text-center" aria-label="이번 주 운동한 날">
          {DAY_LABELS.map((label, i) => (
            <li key={label} className="flex flex-col items-center gap-1">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full border-2 ${
                  status.days[i] ? "border-steel-950 bg-plate-green" : "border-dashed border-steel-600"
                }`}
                aria-hidden="true"
              />
              <span className="text-xs text-steel-400">
                {label}
                <span className="sr-only">{status.days[i] ? " 운동함" : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className={`mt-3 text-sm font-semibold ${status.achieved ? "text-plate-yellow" : "text-steel-200"}`} aria-live="polite">
        {message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
        >
          목표 바꾸기
        </button>
        {status.rest ? (
          <button type="button" disabled={busy} onClick={() => void setRest(false)} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
            쉬는 주 취소
          </button>
        ) : (
          status.canRest && (
            <button type="button" disabled={busy} onClick={() => void setRest(true)} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
              이번 주는 쉬어요
            </button>
          )
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="한 주에 몇 번 운동할까요">
            {Array.from({ length: WEEKLY_GOAL_MAX }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                aria-pressed={status.nextTarget === n}
                aria-label={`주 ${n}번`}
                onClick={() => void setTarget(n)}
                className={`dg-btn min-h-[40px] min-w-[44px] px-2 text-sm ${status.nextTarget === n ? "dg-btn-primary" : "dg-btn-steel"}`}
              >
                <span className="font-num">{n}</span>번
              </button>
            ))}
          </div>
          <p className="text-xs text-steel-400">
            {status.done > 0 ? "이번 주에 이미 운동해서 바꾼 목표는 다음 주부터 적용돼요." : "이번 주에 아직 운동 전이라 바로 적용돼요."}{" "}
            쉬는 주는 4주에 한 번 쓸 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}
