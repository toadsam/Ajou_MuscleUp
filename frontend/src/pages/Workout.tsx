import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import ExercisePicker from "../components/lifts/ExercisePicker";
import LiftHistoryChart from "../components/lifts/LiftHistoryChart";
import PrCelebration from "../components/lifts/PrCelebration";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import {
  formatClock,
  formatDuration,
  loadSession,
  type SessionDetail,
  type SessionSummary,
} from "../lib/workoutSession";
import { loadRun } from "../lib/running";
import {
  LIFT_EXERCISES,
  estimate1rm,
  formatKg,
  type LiftBest,
  type LiftDay,
  type LiftExerciseCode,
  type LiftPoint,
  type LiftSaveResult,
} from "../lib/lifts";

// 운동 기록. 맨 위 "운동 시작"(운동 세션, /workout/session) → 이번 달 운동 목록 → 빠른 기록(한 줄) → 최고 기록 · 그래프.
// 빠른 기록은 종목 · 무게 · 횟수 · 세트를 적으면 추정 1RM 으로 개인 최고를 판단하고, 3대는 마이페이지 기록까지 올린다.

const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function Workout() {
  const [day, setDay] = useState<LiftDay | null>(null);
  const [bests, setBests] = useState<LiftBest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState<LiftExerciseCode>("SQUAT");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("5");
  const [sets, setSets] = useState("3");
  const [yesterday, setYesterday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState<LiftSaveResult | null>(null);
  const [chartExercise, setChartExercise] = useState<LiftExerciseCode | null>(null);
  const [history, setHistory] = useState<LiftPoint[] | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [openSession, setOpenSession] = useState<SessionDetail | null>(null);
  // 진행 중인 세션이 이 기기에 있으면 "이어서 하기"
  const [active] = useState(() => loadSession());
  const [activeRun] = useState(() => loadRun());

  const load = useCallback(async () => {
    try {
      const [dayRes, bestsRes, sessionsRes] = await Promise.all([
        api.get<LiftDay>("/api/lifts"),
        api.get<LiftBest[]>("/api/lifts/bests"),
        api.get<SessionSummary[]>("/api/workouts"),
      ]);
      setDay(dayRes.data);
      setBests(bestsRes.data);
      setSessions(sessionsRes.data);
      setError(null);
    } catch (e: unknown) {
      setError(friendlyError(e, "운동 기록을 불러오지 못했어요."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 그래프 종목: 고른 게 없으면 기록이 있는 첫 종목
  const shownChart = chartExercise ?? bests[0]?.exercise ?? null;
  useEffect(() => {
    if (!shownChart) return;
    let alive = true;
    setHistory(null);
    api
      .get<LiftPoint[]>(`/api/lifts/history?exercise=${shownChart}`)
      .then((res) => alive && setHistory(res.data))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [shownChart, bests]);

  const preview = useMemo(() => estimate1rm(Number(weight), Number(reps)), [weight, reps]);
  const bestOf = (code: LiftExerciseCode) => bests.find((b) => b.exercise === code);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!day || saving) return;
    setSaving(true);
    try {
      const res = await api.post<LiftSaveResult>("/api/lifts", {
        date: yesterday ? shiftDate(day.today, -1) : day.today,
        exercise,
        weightKg: Number(weight),
        reps: Number(reps),
        sets: Number(sets) || 1,
      });
      if (res.data.pr) {
        setCelebrate(res.data);
      } else {
        toast(`${res.data.entry.label} ${formatKg(res.data.entry.weightKg)}kg × ${res.data.entry.reps}회 기록했어요.`, "success");
      }
      await load();
    } catch (e: unknown) {
      toast(friendlyError(e, "기록하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleSession = async (id: number) => {
    if (openSession?.summary.id === id) {
      setOpenSession(null);
      return;
    }
    try {
      setOpenSession((await api.get<SessionDetail>(`/api/workouts/${id}`)).data);
    } catch (e: unknown) {
      toast(friendlyError(e, "운동 기록을 불러오지 못했어요."), "error");
    }
  };

  const removeSession = async (id: number) => {
    if (!window.confirm("이 운동 기록을 지울까요? 이 운동에서 생긴 개인 최고 기록도 지워져요(3대 기록은 그대로).")) return;
    try {
      await api.delete(`/api/workouts/${id}`);
      setOpenSession(null);
      await load();
    } catch (e: unknown) {
      toast(friendlyError(e, "지우지 못했어요."), "error");
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/lifts/${id}`);
      await load();
    } catch (e: unknown) {
      toast(friendlyError(e, "지우지 못했어요."), "error");
    }
  };

  const best = bestOf(exercise);
  const chosen = LIFT_EXERCISES.find((e) => e.code === exercise);

  return (
    <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-bold text-plate-yellow">운동 기록</p>
          <h1 className="text-3xl md:text-4xl">오늘 뭘 들었어요?</h1>
          <p className="text-sm text-steel-400">
            운동을 시작하면 시간 · 세트 · 휴식을 재 줘요. 끝내면 개인 최고(추정 1RM)를 알려 주고, 3대는 5회 이하로 든 기록이 마이페이지 3대 기록에도 반영돼요.
          </p>
        </header>

        {/* 운동 세션 시작 / 이어서 */}
        <Link to="/workout/session" className="dg-steel flex items-center justify-between gap-3 p-4 md:p-5">
          <div>
            <h2 className="font-display text-2xl">{active ? "진행 중인 운동" : "운동 시작"}</h2>
            <p className="mt-1 text-sm text-steel-400">
              {active
                ? `${formatClock((Date.now() - active.startedAt) / 1000)} 째 · 이어서 하기`
                : "종목 · 세트를 체크하면 휴식 타이머가 돌아요"}
            </p>
          </div>
          <span className="dg-btn dg-btn-primary min-h-[48px] px-5 text-base">{active ? "이어서" : "시작"}</span>
        </Link>

        {/* 러닝 */}
        <Link to="/run" className="dg-steel flex items-center justify-between gap-3 p-4 md:p-5">
          <div>
            <h2 className="font-display text-2xl">{activeRun ? "달리는 중" : "러닝"}</h2>
            <p className="mt-1 text-sm text-steel-400">
              {activeRun ? "이어서 달리기" : "GPS로 거리 · 페이스 · 1km 구간을 재요"}
            </p>
          </div>
          <span className="dg-btn dg-btn-steel min-h-[48px] px-5 text-base">{activeRun ? "이어서" : "달리기"}</span>
        </Link>

        {/* 이번 달 운동 */}
        {sessions.length > 0 && (
          <div className="dg-steel p-4 md:p-5">
            <h2 className="font-display text-xl">이번 달 운동 {sessions.length}번</h2>
            <ul className="mt-2 divide-y-2 divide-dashed divide-steel-700">
              {sessions.map((s) => {
                const opened = openSession?.summary.id === s.id ? openSession : null;
                return (
                  <li key={s.id} className="py-2">
                    <button
                      type="button"
                      onClick={() => void toggleSession(s.id)}
                      aria-expanded={Boolean(opened)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {s.date.slice(5).replace("-", "/")} · {formatDuration(s.durationSec)}
                        </span>
                        <span className="block truncate text-sm text-steel-400">{s.exercises.join(", ")}</span>
                      </span>
                      <span className="flex-none text-right text-sm text-steel-300">
                        <span className="font-num text-lg text-white">{Math.round(s.totalVolume).toLocaleString()}</span>kg
                        <span className="block text-xs">{s.totalSets}세트</span>
                      </span>
                    </button>
                    {opened && (
                      <div className="mt-2 space-y-1 rounded bg-steel-900/60 p-3 text-sm">
                        {opened.exercises.map((e) => (
                          <p key={e.exercise}>
                            <strong>{e.label}</strong>{" "}
                            <span className="text-steel-400">
                              {e.sets.map((x) => (e.bodyweight && !x.weightKg ? `${x.reps}회` : `${formatKg(x.weightKg)}×${x.reps}`)).join(" · ")}
                            </span>
                          </p>
                        ))}
                        {opened.note && <p className="text-steel-300">"{opened.note}"</p>}
                        <button
                          type="button"
                          onClick={() => void removeSession(s.id)}
                          className="dg-btn dg-btn-steel mt-1 min-h-[32px] px-3 text-xs"
                        >
                          이 운동 지우기
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && (
          <div className="dg-steel flex flex-wrap items-center gap-3 p-5">
            <p role="alert" className="text-sm font-semibold text-red-300">
              {error}
            </p>
            <button type="button" onClick={() => void load()} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
              다시 시도
            </button>
          </div>
        )}

        {/* 기록하기 */}
        <form onSubmit={submit} className="dg-steel space-y-4 p-4 md:p-5">
          <fieldset>
            <legend className="mb-1 font-display text-xl">빠른 기록</legend>
            <p className="mb-3 text-xs text-steel-400">세션 없이 가장 무거웠던 세트 하나만 적을 때</p>
            <ExercisePicker selected={exercise} onPick={(e) => setExercise(e.code)} weightedOnly />
          </fieldset>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1 text-sm text-steel-300">
              <span>무게(kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                max={500}
                step={0.5}
                required
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={best ? formatKg(best.maxWeightKg) : "60"}
                className="dg-well w-full px-3 py-2 font-num text-lg text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-steel-300">
              <span>횟수</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                required
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="dg-well w-full px-3 py-2 font-num text-lg text-white"
              />
            </label>
            <label className="space-y-1 text-sm text-steel-300">
              <span>세트</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                className="dg-well w-full px-3 py-2 font-num text-lg text-white"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-steel-300" aria-live="polite">
              추정 1RM <strong className="font-num text-lg text-white">{preview ? `${formatKg(preview)}kg` : "-"}</strong>
              {best && (
                <span className="text-steel-400">
                  {" · "}내 최고 {formatKg(best.e1rm)}kg
                  {preview > best.e1rm && <strong className="text-plate-yellow"> 갱신!</strong>}
                </span>
              )}
            </p>
            <label className="flex items-center gap-2 text-sm text-steel-300">
              <input type="checkbox" checked={yesterday} onChange={(e) => setYesterday(e.target.checked)} className="h-5 w-5" />
              어제 한 운동
            </label>
          </div>
          {chosen?.bigThree && Number(reps) > 5 && (
            <p className="text-xs text-steel-400">6회 이상은 추정이 부풀어서 3대 기록에는 반영하지 않아요.</p>
          )}

          <button type="submit" disabled={saving || !day} className="dg-btn dg-btn-primary min-h-[48px] w-full text-base">
            {saving ? "기록하는 중..." : "기록하기"}
          </button>
        </form>

        {/* 오늘 기록 */}
        <div className="dg-steel p-4 md:p-5">
          <h2 className="font-display text-xl">오늘 기록</h2>
          {!day ? (
            <span className="dg-loading-plates mt-3" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : day.entries.length === 0 ? (
            <p className="mt-2 text-sm text-steel-400">
              아직 없어요. 출석만 하고 싶으면 <Link to="/attendance" className="text-plate-yellow underline underline-offset-4">출석 체크</Link>로.
            </p>
          ) : (
            <ul className="mt-3 divide-y-2 divide-dashed divide-steel-700">
              {day.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.label}</p>
                    <p className="text-sm text-steel-400">
                      <span className="font-num text-base text-white">{formatKg(e.weightKg)}</span>kg × {e.reps}회 × {e.sets}세트 · 추정 1RM{" "}
                      {formatKg(e.e1rm)}kg
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(e.id)}
                    aria-label={`${e.label} ${formatKg(e.weightKg)}kg 기록 지우기`}
                    className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
                  >
                    지우기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 개인 최고 · 그래프 */}
        {bests.length > 0 && (
          <div className="dg-whiteboard p-4 md:p-5">
            <h2 className="board-title font-pen text-3xl">내 최고 기록</h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {bests.map((b) => (
                <li key={b.exercise}>
                  <button
                    type="button"
                    onClick={() => setChartExercise(b.exercise)}
                    aria-pressed={shownChart === b.exercise}
                    className={`w-full rounded px-2 py-1 text-left ${shownChart === b.exercise ? "bg-board-ink/10" : ""}`}
                  >
                    <span className="block text-xs text-steel-600">
                      {b.label}
                      {b.bigThree && " · 3대"}
                    </span>
                    <span className="font-num text-2xl text-steel-950">{formatKg(b.e1rm)}kg</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shownChart && (
          <div className="dg-steel p-4 md:p-5">
            <h2 className="font-display text-xl">{LIFT_EXERCISES.find((e) => e.code === shownChart)?.label} 성장 그래프</h2>
            <p className="mt-1 text-xs text-steel-400">최근 180일, 날마다 가장 높은 추정 1RM</p>
            <div className="mt-3 h-56">
              {history === null ? (
                <span className="dg-loading-plates" aria-label="불러오는 중">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : history.length < 2 ? (
                <p className="text-sm text-steel-400">기록이 이틀 이상 쌓이면 그래프가 그려져요.</p>
              ) : (
                <LiftHistoryChart points={history} />
              )}
            </div>
          </div>
        )}
      </div>

      <PrCelebration result={celebrate} onClose={() => setCelebrate(null)} />
    </section>
  );
}
