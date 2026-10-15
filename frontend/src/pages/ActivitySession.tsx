import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import { formatClock, formatDuration } from "../lib/workoutSession";
import {
  CATEGORY_LABEL,
  MAX_ACTIVITY_SEC,
  clearActiveActivity,
  fetchActivities,
  loadActiveActivity,
  saveActiveActivity,
  saveActivityLog,
  type ActiveActivity,
  type Activity,
  type ActivityLogResult,
} from "../lib/activities";

// 내가 추가한 운동 한 번(필라테스 · 수영 등) — 시간 + 메모만.
// "시작"을 누르면 시간을 재고(이 기기에 저장, 화면을 나갔다 와도 이어짐), "끝내기"에서 메모 · 출석과 함께 저장한다.
// 이미 끝낸 운동은 "시간 직접 적기"로 몇 분 했는지만 적는다.

const MINUTE_CHOICES = [30, 45, 60, 90];

export default function ActivitySession() {
  const { id } = useParams();
  const activityId = Number(id);
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState<ActiveActivity | null>(() => loadActiveActivity());
  const [now, setNow] = useState(() => Date.now());
  const [finishOpen, setFinishOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [minutes, setMinutes] = useState("60");
  const [note, setNote] = useState("");
  const [checkAttendance, setCheckAttendance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActivityLogResult | null>(null);

  useEffect(() => {
    fetchActivities()
      .then((list) => {
        const a = list.find((x) => x.id === activityId) ?? null;
        setActivity(a);
        setMissing(!a);
      })
      .catch((e: unknown) => {
        setMissing(true);
        toast(friendlyError(e, "운동을 불러오지 못했어요."), "error");
      });
  }, [activityId]);

  const mine = active?.activityId === activityId ? active : null;
  const other = active && active.activityId !== activityId ? active : null;

  useEffect(() => {
    if (!mine) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [mine]);

  const start = () => {
    if (!activity) return;
    const a = { activityId: activity.id, name: activity.name, startedAt: Date.now() };
    saveActiveActivity(a);
    setActive(a);
    setNow(Date.now());
  };

  const elapsed = mine ? Math.max(0, Math.round((now - mine.startedAt) / 1000)) : 0;
  // 끝내기를 잊어 12시간을 넘겼으면 실제 시간을 고르게 한다(서버 한도 1분 ~ 12시간)
  const tooLong = elapsed > MAX_ACTIVITY_SEC;

  const openFinish = () => {
    setNote("");
    setMinutes(tooLong ? "60" : String(Math.max(1, Math.round(elapsed / 60))));
    setFinishOpen(true);
  };

  const openManual = () => {
    setNote("");
    setMinutes("60");
    setManualOpen(true);
  };

  const save = async (durationSec: number, endedAt?: number) => {
    if (!activity || saving) return;
    if (durationSec < 60 || durationSec > MAX_ACTIVITY_SEC) {
      toast("운동 시간은 1분 ~ 12시간 사이로 적어 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await saveActivityLog(activity.id, {
        durationSec,
        endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
        note: note.trim() || null,
        checkAttendance,
      });
      if (mine) clearActiveActivity();
      setActive(other);
      setFinishOpen(false);
      setManualOpen(false);
      setResult(res);
    } catch (e: unknown) {
      toast(friendlyError(e, "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    if (!mine) return;
    if (tooLong) {
      // 끝난 시각 = 시작 + 고른 시간
      const sec = Math.round(Number(minutes) * 60);
      void save(sec, mine.startedAt + sec * 1000);
    } else {
      void save(elapsed);
    }
  };

  const discard = () => {
    clearActiveActivity();
    setActive(null);
    setFinishOpen(false);
  };

  const memoAndAttendance = (
    <>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="한 줄 메모(선택) · 예: 코어 위주, 자유형 1km"
        aria-label="메모"
        className="dg-well w-full px-3 py-2 text-white"
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checkAttendance} onChange={(e) => setCheckAttendance(e.target.checked)} className="h-5 w-5" />
        오늘 출석도 체크하기(아직 안 했을 때)
      </label>
    </>
  );

  const minutePicker = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="운동한 시간">
        {MINUTE_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={Number(minutes) === m}
            onClick={() => setMinutes(String(m))}
            className={`dg-btn min-h-[36px] px-3 text-xs ${Number(minutes) === m ? "dg-btn-primary" : "dg-btn-steel"}`}
          >
            {formatDuration(m * 60)}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={720}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="dg-well min-h-[40px] w-24 px-3 text-right font-num text-lg text-white"
          aria-label="운동한 시간(분)"
        />
        <span className="text-steel-300">분</span>
      </label>
    </div>
  );

  // ── 저장한 뒤
  if (result) {
    const a = result.attendance;
    return (
      <section className="min-h-screen px-4 pb-28 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-md space-y-5">
          <header className="space-y-1">
            <p className="text-sm font-bold text-plate-yellow">{result.log.name} 끝</p>
            <h1 className="text-3xl">수고했어요!</h1>
          </header>
          <div className="dg-steel space-y-2 p-5">
            <p className="text-xs text-steel-400">운동 시간</p>
            <p className="font-num text-4xl">{formatDuration(result.log.durationSec)}</p>
            {result.log.note && <p className="text-sm text-steel-300">"{result.log.note}"</p>}
          </div>
          {a.created && (
            <div className="dg-steel border-l-8 border-plate-green p-4 text-sm">
              <p className="font-semibold">오늘 출석도 체크했어요</p>
              {a.expEarned ? <p className="text-steel-300">경험치 +{a.expEarned}</p> : null}
            </div>
          )}
          <div className="flex gap-2">
            <Link to="/workout" className="dg-btn dg-btn-primary min-h-[48px] flex-1">
              운동 기록 보기
            </Link>
            <Link to="/" className="dg-btn dg-btn-steel min-h-[48px] flex-1">
              홈으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (missing) {
    return (
      <section className="min-h-screen px-4 pb-28 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="text-2xl">운동을 찾을 수 없어요</h1>
          <p className="text-sm text-steel-400">목록에서 뺐거나 없는 운동이에요.</p>
          <button type="button" onClick={() => navigate("/workout/start")} className="dg-btn dg-btn-primary min-h-[44px] px-4">
            운동 고르기로
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-4 pb-28 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-md space-y-5">
        <header className="space-y-1">
          <Link to="/workout/start" className="text-xs text-steel-400 underline underline-offset-4">
            운동 고르기
          </Link>
          <h1 className="text-4xl">{activity?.name ?? "…"}</h1>
          {activity && <p className="text-sm text-steel-400">{CATEGORY_LABEL[activity.category]} · 시간 + 메모만 기록해요</p>}
        </header>

        {other && (
          <div className="dg-steel p-4 text-sm" role="status">
            <p>
              <strong>{other.name}</strong> 시간을 재는 중이에요.
            </p>
            <Link to={`/activity/${other.activityId}`} className="mt-2 inline-block text-plate-yellow underline underline-offset-4">
              {other.name}(으)로 가기
            </Link>
          </div>
        )}

        {mine ? (
          <div className="dg-steel space-y-4 border-l-8 border-plate-green p-5 text-center">
            <p className="text-xs text-steel-400">운동 시간</p>
            <p className="font-num text-6xl tabular-nums">{formatClock(elapsed)}</p>
            <button type="button" onClick={openFinish} className="dg-btn dg-btn-primary min-h-[56px] w-full text-lg">
              끝내기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={start}
              disabled={!activity || Boolean(other)}
              className="dg-btn dg-btn-primary min-h-[64px] w-full text-xl"
            >
              시작
            </button>
            <button type="button" onClick={openManual} disabled={!activity} className="dg-btn dg-btn-steel min-h-[48px] w-full">
              이미 했어요 · 시간 직접 적기
            </button>
          </div>
        )}
      </div>

      <DialogFrame open={finishOpen} onClose={() => setFinishOpen(false)} title={`${activity?.name ?? ""} 끝내기`} busy={saving}>
        <div className="space-y-3 text-sm">
          {tooLong ? (
            <div className="dg-well space-y-2 p-3">
              <p className="font-semibold text-plate-yellow">끝내기를 잊으셨나요?</p>
              <p className="text-steel-300">12시간까지 저장돼요. 실제로 운동한 시간을 골라 주세요.</p>
              {minutePicker}
            </div>
          ) : (
            <p className="text-steel-300">운동 시간 {formatDuration(elapsed)}</p>
          )}
          {memoAndAttendance}
          <div className="flex gap-2">
            <button type="button" onClick={() => setFinishOpen(false)} disabled={saving} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              계속하기
            </button>
            <button type="button" onClick={finish} disabled={saving} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              {saving ? "저장 중..." : "저장하고 끝내기"}
            </button>
          </div>
          <button type="button" onClick={discard} disabled={saving} className="block w-full text-center text-xs text-steel-500 underline underline-offset-4">
            기록하지 않고 그만두기
          </button>
        </div>
      </DialogFrame>

      <DialogFrame open={manualOpen} onClose={() => setManualOpen(false)} title="몇 분 했어요?" busy={saving}>
        <div className="space-y-3 text-sm">
          {minutePicker}
          {memoAndAttendance}
          <div className="flex gap-2">
            <button type="button" onClick={() => setManualOpen(false)} disabled={saving} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              취소
            </button>
            <button
              type="button"
              onClick={() => void save(Math.round(Number(minutes) * 60))}
              disabled={saving || !(Number(minutes) >= 1)}
              className="dg-btn dg-btn-primary min-h-[44px] flex-1"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </DialogFrame>
    </section>
  );
}
