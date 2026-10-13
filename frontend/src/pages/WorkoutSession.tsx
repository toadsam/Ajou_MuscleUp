import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import ExercisePicker from "../components/lifts/ExercisePicker";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import { BOX_REASON } from "../lib/collection";
import { exerciseInfo, formatKg, useCustomExercises, type LiftExerciseInfo } from "../lib/lifts";
import {
  REST_CHOICES,
  clearSession,
  doneSetCount,
  doneVolume,
  formatClock,
  formatDuration,
  loadSession,
  newSession,
  saveSession,
  type ActiveExercise,
  type ActiveSession,
  type PreviousSets,
  type SessionSaveResult,
} from "../lib/workoutSession";

// 운동 세션(번핏처럼). 시작 → 종목 추가(지난번 값 미리 채움) → 세트마다 무게 · 횟수 · 체크 → 체크하면 휴식 타이머 → 끝내기.
// 진행 중 상태는 이 기기(localStorage)에만 — 끝낼 때 POST /api/workouts 한 번.
// 휴식이 끝나면 진동 · 소리(화면이 켜져 있을 때). 화면 꺼짐 방지는 "화면 켜 두기"(Wake Lock, 지원하는 브라우저만).

type WakeLockLike = { release: () => Promise<void> };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/** 짧은 "삐삑" — 세트 체크(사용자가 누른 순간)에 오디오를 열어 둬야 나중에 소리가 난다 */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctxRef.current && Ctor) ctxRef.current = new Ctor();
      void ctxRef.current?.resume();
    } catch {
      // 소리를 못 내도 진동 · 화면 알림은 된다
    }
  }, []);
  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  }, []);
  return { unlock, beep };
}

export default function WorkoutSession() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ActiveSession | null>(() => loadSession());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [checkAttendance, setCheckAttendance] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SessionSaveResult | null>(null);
  const [keepAwake, setKeepAwake] = useState(false);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const restAlertedRef = useRef<number | null>(null);
  const now = useNow(Boolean(session));
  const { unlock, beep } = useBeep();
  useCustomExercises(); // 직접 추가한 종목 이름 · 맨몸 여부

  // 바뀔 때마다 이 기기에 저장(새로고침 · 화면 꺼짐에도 이어서)
  useEffect(() => {
    if (session) saveSession(session);
  }, [session]);

  const update = useCallback((fn: (s: ActiveSession) => ActiveSession) => {
    setSession((prev) => (prev ? fn(prev) : prev));
  }, []);

  // 휴식 끝 알림(한 번만)
  const rest = session?.rest ?? null;
  const restLeft = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!rest || restLeft > 0 || restAlertedRef.current === rest.endsAt) return;
    restAlertedRef.current = rest.endsAt;
    beep();
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // 진동을 못 쓰는 기기
    }
    toast("휴식 끝! 다음 세트 가요.", "success");
    update((s) => ({ ...s, rest: null }));
  }, [rest, restLeft, beep, update]);

  // 화면 켜 두기(Wake Lock) — 다른 앱에 다녀오면 풀리므로 돌아올 때 다시 요청
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } };
    if (!keepAwake || !nav.wakeLock) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) void lock.release();
        else wakeRef.current = lock;
      } catch {
        // 배터리 절약 모드 등으로 거절될 수 있다
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
    };
  }, [keepAwake]);

  const start = () => {
    unlock();
    setSession(newSession());
    setResult(null);
  };

  const addExercise = async (info: LiftExerciseInfo) => {
    setPickerOpen(false);
    let previous: PreviousSets | null = null;
    try {
      const res = await api.get<PreviousSets>(`/api/workouts/previous?exercise=${info.code}`, { validateStatus: (s) => s === 200 || s === 204 });
      previous = res.status === 200 ? res.data : null;
    } catch {
      previous = null;
    }
    const sets =
      previous && previous.sets.length > 0
        ? previous.sets.slice(0, 6).map((p) => ({ weight: formatKg(p.weightKg), reps: String(p.reps), done: false }))
        : [{ weight: info.bodyweight ? "0" : "", reps: "", done: false }];
    update((s) => ({ ...s, exercises: [...s.exercises, { code: info.code, sets, previous }] }));
  };

  const setField = (ei: number, si: number, field: "weight" | "reps", value: string) =>
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j !== si ? x : { ...x, [field]: value })) },
      ),
    }));

  const toggleDone = (ei: number, si: number) => {
    unlock();
    const set = session?.exercises[ei]?.sets[si];
    if (!set) return;
    const info = exerciseInfo(session!.exercises[ei].code);
    if (!set.done) {
      const w = Number(set.weight);
      const r = Number(set.reps);
      if (!(r >= 1) || (!info?.bodyweight && !(w > 0)) || w < 0) {
        toast(info?.bodyweight ? "횟수를 적어 주세요." : "무게와 횟수를 적어 주세요.", "error");
        return;
      }
    }
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j !== si ? x : { ...x, done: !x.done })) },
      ),
      // 세트를 끝내면 휴식 시작
      rest: !set.done ? { endsAt: Date.now() + s.restSeconds * 1000, seconds: s.restSeconds } : s.rest,
    }));
  };

  const addSet = (ei: number) =>
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== ei) return e;
        const last = e.sets[e.sets.length - 1];
        return { ...e, sets: [...e.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "", done: false }] };
      }),
    }));

  const removeSet = (ei: number, si: number) =>
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })),
    }));

  const removeExercise = (ei: number) => update((s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== ei) }));

  const shiftRest = (delta: number) =>
    update((s) => (s.rest ? { ...s, rest: { ...s.rest, endsAt: Math.max(Date.now(), s.rest.endsAt + delta * 1000) } } : s));

  const finish = async () => {
    if (!session || saving) return;
    const exercises = session.exercises
      .map((e) => ({
        exercise: e.code,
        sets: e.sets.filter((x) => x.done).map((x) => ({ weightKg: Number(x.weight) || 0, reps: Number(x.reps) })),
      }))
      .filter((e) => e.sets.length > 0);
    setSaving(true);
    try {
      const res = await api.post<SessionSaveResult>("/api/workouts", {
        startedAt: new Date(session.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        exercises,
        checkAttendance,
        note: note.trim() || null,
      });
      clearSession();
      setSession(null);
      setFinishOpen(false);
      setResult(res.data);
    } catch (e: unknown) {
      toast(friendlyError(e, "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    clearSession();
    setSession(null);
    setDiscardOpen(false);
    navigate("/workout");
  };

  // ── 끝난 뒤 결과
  if (result) {
    const s = result.session.summary;
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <header className="space-y-1">
            <p className="text-sm font-bold text-plate-yellow">운동 끝</p>
            <h1 className="text-3xl">수고했어요!</h1>
          </header>
          <div className="dg-steel grid grid-cols-3 gap-2 p-4 text-center">
            <div>
              <p className="text-xs text-steel-400">운동 시간</p>
              <p className="font-num text-2xl">{formatDuration(s.durationSec)}</p>
            </div>
            <div>
              <p className="text-xs text-steel-400">세트</p>
              <p className="font-num text-2xl">{s.totalSets}</p>
            </div>
            <div>
              <p className="text-xs text-steel-400">총 볼륨</p>
              <p className="font-num text-2xl">{Math.round(s.totalVolume).toLocaleString()}kg</p>
            </div>
          </div>
          {result.prs.length > 0 && (
            <div className="dg-steel space-y-2 p-4">
              <h2 className="font-display text-xl text-plate-yellow">개인 최고 {result.prs.length}개!</h2>
              <ul className="space-y-1 text-sm">
                {result.prs.map((p) => (
                  <li key={p.exercise}>
                    <strong>{p.label}</strong> 추정 1RM <span className="font-num text-lg">{formatKg(p.e1rm)}kg</span>
                    {p.previousE1rm != null ? ` (이전 ${formatKg(p.previousE1rm)}kg)` : " (첫 기록)"}
                  </li>
                ))}
              </ul>
              {result.statUpdates.map((u) => (
                <p key={u.exercise} className="text-sm text-steel-300">
                  마이페이지 3대: {u.label} {u.before != null ? `${formatKg(u.before)} → ` : ""}
                  {formatKg(u.after)}kg
                </p>
              ))}
              {result.points > 0 && <p className="text-sm font-semibold text-plate-yellow">활동 점수 +{result.points}</p>}
            </div>
          )}
          {result.attendance.created && (
            <p className="dg-well p-3 text-sm text-steel-200">
              오늘 출석도 체크했어요{result.attendance.expEarned ? ` (+${result.attendance.expEarned})` : ""}.
              {result.attendance.weeklyGoalBonus ? ` 주간 목표 달성 보너스 +${result.attendance.weeklyGoalBonus}!` : ""}
            </p>
          )}
          {result.attendance.rewardBox && (
            <Link to="/collection" className="dg-steel flex items-center gap-3 p-3 text-sm">
              <span className="flex-1 font-semibold">{BOX_REASON[result.attendance.rewardBox] ?? "보상 상자"}를 받았어요!</span>
              <span className="dg-btn dg-btn-primary min-h-[36px] px-3 text-xs">열러 가기</span>
            </Link>
          )}
          <div className="dg-steel p-4">
            <ul className="space-y-2 text-sm">
              {result.session.exercises.map((e) => (
                <li key={e.exercise}>
                  <strong>{e.label}</strong>{" "}
                  <span className="text-steel-400">
                    {e.sets.map((x) => (e.bodyweight && !x.weightKg ? `${x.reps}회` : `${formatKg(x.weightKg)}×${x.reps}`)).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <Link to="/workout" className="dg-btn dg-btn-primary min-h-[44px] flex-1 text-base">
              운동 기록 보기
            </Link>
            <Link to="/" className="dg-btn dg-btn-steel min-h-[44px] flex-1 text-base">
              홈으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ── 시작 전
  if (!session) {
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <header className="space-y-2">
            <p className="text-sm font-bold text-plate-yellow">운동 세션</p>
            <h1 className="text-3xl">오늘 운동 시작할까요?</h1>
            <p className="text-sm text-steel-400">
              시작하면 운동 시간이 재지고, 세트를 체크할 때마다 휴식 타이머가 돌아요. 끝내면 개인 최고 · 3대 기록 · 출석까지 한 번에 남겨요.
            </p>
          </header>
          <button type="button" onClick={start} className="dg-btn dg-btn-primary min-h-[56px] w-full text-lg">
            운동 시작
          </button>
          <Link to="/workout" className="block text-center text-sm text-steel-400 underline underline-offset-4">
            지난 운동 기록 보기
          </Link>
        </div>
      </section>
    );
  }

  // ── 운동 중
  const elapsed = (now - session.startedAt) / 1000;
  const usedCodes = session.exercises.map((e) => e.code);
  const sets = doneSetCount(session);
  return (
    <section className="min-h-screen px-4 pb-40 pt-24 text-white md:px-10">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* 상단: 운동 시간 · 끝내기 */}
        <div className="dg-steel sticky top-20 z-20 flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-xs text-steel-400">운동 시간</p>
            <p className="font-num text-3xl leading-none" aria-live="off">
              {formatClock(elapsed)}
            </p>
          </div>
          <div className="text-right text-xs text-steel-400">
            <p>
              세트 <span className="font-num text-base text-white">{sets}</span>
            </p>
            <p>
              볼륨 <span className="font-num text-base text-white">{Math.round(doneVolume(session)).toLocaleString()}</span>kg
            </p>
          </div>
          <button type="button" onClick={() => setFinishOpen(true)} className="dg-btn dg-btn-primary min-h-[44px] px-4 text-sm">
            끝내기
          </button>
        </div>

        {/* 설정: 휴식 길이 · 화면 켜 두기 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-steel-300">
          <span>휴식</span>
          {REST_CHOICES.map((sec) => (
            <button
              key={sec}
              type="button"
              aria-pressed={session.restSeconds === sec}
              onClick={() => update((s) => ({ ...s, restSeconds: sec }))}
              className={`dg-btn min-h-[32px] px-2 text-xs ${session.restSeconds === sec ? "dg-btn-primary" : "dg-btn-steel"}`}
            >
              {sec < 120 ? `${sec}초` : `${sec / 60}분`}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5">
            <input type="checkbox" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} className="h-4 w-4" />
            화면 켜 두기
          </label>
        </div>

        {session.exercises.length === 0 && (
          <p className="dg-steel p-4 text-sm text-steel-300">아래 "종목 추가"로 첫 종목을 넣어 주세요. 지난번에 한 무게 · 횟수가 미리 채워져요.</p>
        )}

        {session.exercises.map((ex: ActiveExercise, ei) => {
          const info = exerciseInfo(ex.code);
          return (
            <div key={`${ex.code}-${ei}`} className="dg-steel p-3 md:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl">{info?.label ?? ex.code}</h2>
                  {ex.previous && (
                    <p className="text-xs text-steel-400">
                      지난번 {ex.previous.date.slice(5).replace("-", "/")}:{" "}
                      {ex.previous.sets
                        .slice(0, 5)
                        .map((p) => (info?.bodyweight && !p.weightKg ? `${p.reps}회` : `${formatKg(p.weightKg)}×${p.reps}`))
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeExercise(ei)}
                  aria-label={`${info?.label ?? ex.code} 빼기`}
                  className="dg-btn dg-btn-steel min-h-[32px] px-2 text-xs"
                >
                  빼기
                </button>
              </div>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-xs text-steel-400">
                    <th className="w-8 text-left font-normal">세트</th>
                    <th className="font-normal">{info?.bodyweight ? "추가 kg" : "kg"}</th>
                    <th className="font-normal">회</th>
                    <th className="w-12 font-normal">완료</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((set, si) => (
                    <tr key={si} className={set.done ? "bg-plate-green/15" : ""}>
                      <td className="py-1 font-num text-base">{si + 1}</td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.5}
                          value={set.weight}
                          disabled={set.done}
                          onChange={(e) => setField(ei, si, "weight", e.target.value)}
                          aria-label={`${si + 1}세트 무게`}
                          className="dg-well w-full px-2 py-1.5 text-center font-num text-lg text-white disabled:opacity-70"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={set.reps}
                          disabled={set.done}
                          onChange={(e) => setField(ei, si, "reps", e.target.value)}
                          aria-label={`${si + 1}세트 횟수`}
                          className="dg-well w-full px-2 py-1.5 text-center font-num text-lg text-white disabled:opacity-70"
                        />
                      </td>
                      <td className="py-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleDone(ei, si)}
                          aria-pressed={set.done}
                          aria-label={`${si + 1}세트 ${set.done ? "완료 취소" : "완료"}`}
                          className={`grid h-10 w-10 place-items-center rounded border-[3px] border-steel-950 ${
                            set.done ? "dg-pop bg-plate-green text-white" : "bg-steel-700 text-steel-400"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 13l5 5L21 5" />
                          </svg>
                        </button>
                      </td>
                      <td className="py-1 text-center">
                        {!set.done && ex.sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSet(ei, si)}
                            aria-label={`${si + 1}세트 지우기`}
                            className="text-lg leading-none text-steel-500"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => addSet(ei)} className="dg-btn dg-btn-steel mt-2 min-h-[36px] w-full text-sm">
                + 세트
              </button>
            </div>
          );
        })}

        <button type="button" onClick={() => setPickerOpen(true)} className="dg-btn dg-btn-steel min-h-[48px] w-full text-base">
          + 종목 추가
        </button>
        <button type="button" onClick={() => setDiscardOpen(true)} className="block w-full text-center text-xs text-steel-500 underline underline-offset-4">
          기록하지 않고 그만두기
        </button>
      </div>

      {/* 휴식 타이머 */}
      {rest && restLeft > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-steel-950 bg-steel-900 px-4 pb-5 pt-3" role="timer" aria-live="polite">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-steel-400">휴식</p>
              <p className="font-num text-3xl leading-none text-plate-yellow">{formatClock(restLeft)}</p>
              <span className="mt-1 block h-2 overflow-hidden rounded bg-steel-700" aria-hidden="true">
                <i
                  className="block h-full bg-plate-yellow transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (restLeft / rest.seconds) * 100)}%` }}
                />
              </span>
            </div>
            <button type="button" onClick={() => shiftRest(-15)} className="dg-btn dg-btn-steel min-h-[40px] px-2 text-sm">
              -15초
            </button>
            <button type="button" onClick={() => shiftRest(15)} className="dg-btn dg-btn-steel min-h-[40px] px-2 text-sm">
              +15초
            </button>
            <button type="button" onClick={() => update((s) => ({ ...s, rest: null }))} className="dg-btn dg-btn-primary min-h-[40px] px-3 text-sm">
              건너뛰기
            </button>
          </div>
        </div>
      )}

      <DialogFrame open={pickerOpen} onClose={() => setPickerOpen(false)} title="종목 추가">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <ExercisePicker onPick={(info) => void addExercise(info)} disabledCodes={usedCodes} />
        </div>
      </DialogFrame>

      <DialogFrame open={finishOpen} onClose={() => setFinishOpen(false)} title="운동 끝내기" busy={saving}>
        <div className="space-y-3 text-sm">
          <p className="text-steel-300">
            {formatDuration(elapsed)} · 끝낸 세트 {sets}개 · 볼륨 {Math.round(doneVolume(session)).toLocaleString()}kg
          </p>
          {sets === 0 && <p className="text-red-300">체크한 세트가 없어요. 세트 옆 체크를 눌러 주세요.</p>}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={checkAttendance} onChange={(e) => setCheckAttendance(e.target.checked)} className="h-5 w-5" />
            오늘 출석도 체크하기(아직 안 했을 때)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="한 줄 메모(선택)"
            aria-label="메모"
            className="dg-well w-full px-3 py-2 text-white"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setFinishOpen(false)} disabled={saving} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              계속하기
            </button>
            <button type="button" onClick={() => void finish()} disabled={saving || sets === 0} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              {saving ? "저장 중..." : "저장하고 끝내기"}
            </button>
          </div>
        </div>
      </DialogFrame>

      <DialogFrame open={discardOpen} onClose={() => setDiscardOpen(false)} title="기록하지 않고 그만둘까요?" tone="danger">
        <div className="space-y-3 text-sm">
          <p className="text-steel-300">지금까지 적은 세트가 모두 사라져요.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDiscardOpen(false)} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              계속하기
            </button>
            <button type="button" onClick={discard} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              그만두기
            </button>
          </div>
        </div>
      </DialogFrame>
    </section>
  );
}
