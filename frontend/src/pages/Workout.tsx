import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LiftHistoryChart from "../components/lifts/LiftHistoryChart";
import PrCelebration from "../components/lifts/PrCelebration";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
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

// 운동 기록(PR F). 종목 · 무게 · 횟수 · 세트를 적으면 추정 1RM 으로 개인 최고를 판단하고,
// 3대는 마이페이지 기록까지 올려 캐릭터에 반영한다. 아래에 종목별 최고 기록 · 성장 그래프.

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

  const load = useCallback(async () => {
    try {
      const [dayRes, bestsRes] = await Promise.all([api.get<LiftDay>("/api/lifts"), api.get<LiftBest[]>("/api/lifts/bests")]);
      setDay(dayRes.data);
      setBests(bestsRes.data);
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
            가장 무거웠던 세트를 적으면 추정 1RM으로 개인 최고를 알려 줘요. 3대는 5회 이하로 든 기록이 마이페이지 3대 기록에도 반영돼요.
          </p>
        </header>

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
            <legend className="mb-2 font-display text-xl">종목</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LIFT_EXERCISES.map((e) => (
                <button
                  key={e.code}
                  type="button"
                  aria-pressed={exercise === e.code}
                  onClick={() => setExercise(e.code)}
                  className={`dg-btn min-h-[44px] px-2 text-sm ${exercise === e.code ? "dg-btn-primary" : "dg-btn-steel"}`}
                >
                  {e.label}
                </button>
              ))}
            </div>
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
