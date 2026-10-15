import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import { formatClock, loadSession } from "../lib/workoutSession";
import { loadRun } from "../lib/running";
import {
  ACTIVITY_EXAMPLES,
  CATEGORY_LABEL,
  MAX_ACTIVITY_NAME,
  addActivity,
  fetchActivities,
  loadActiveActivity,
  removeActivity,
  type Activity,
  type ActivityCategory,
} from "../lib/activities";

// 운동 시작 — 무엇을 할지 고른다: 헬스(세트 · 무게, /workout/session) · 러닝(GPS, /run) · 내가 추가한 운동(시간 + 메모, /activity/:id).
// "+ 운동 추가"로 필라테스 · 수영 같은 걸 넣으면 다음부터 여기 같이 뜬다. 진행 중인 것이 있으면 "이어서".

const CATEGORIES: ActivityCategory[] = ["CARDIO", "STRETCH", "WEIGHT"];

export default function WorkoutStart() {
  const [gym] = useState(() => loadSession());
  const [run] = useState(() => loadRun());
  const [activeActivity] = useState(() => loadActiveActivity());
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("CARDIO");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<Activity | null>(null);

  useEffect(() => {
    fetchActivities()
      .then(setActivities)
      .catch((e: unknown) => {
        setActivities([]);
        toast(friendlyError(e, "내 운동을 불러오지 못했어요."), "error");
      });
  }, []);

  const openAdd = () => {
    setName("");
    setCategory("CARDIO");
    setAddOpen(true);
  };

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      const a = await addActivity(n, category);
      setActivities((list) => [...(list ?? []), a]);
      setAddOpen(false);
      toast(`${a.name}을(를) 추가했어요`, "success");
    } catch (err: unknown) {
      toast(friendlyError(err, "추가하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeActivity(removing.id);
      setActivities((list) => (list ?? []).filter((a) => a.id !== removing.id));
      toast(`${removing.name}을(를) 뺐어요. 지난 기록은 남아요.`);
    } catch (err: unknown) {
      toast(friendlyError(err, "빼지 못했어요."), "error");
    } finally {
      setRemoving(null);
    }
  };

  const since = (startedAt: number) => `${formatClock((Date.now() - startedAt) / 1000)} 째 · 이어서 하기`;

  return (
    <section className="min-h-screen px-4 pb-28 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-plate-yellow">운동 시작</p>
          <h1 className="text-3xl md:text-4xl">오늘은 뭐 할까요?</h1>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/workout/session" className="dg-steel dg-lift flex min-h-[132px] flex-col justify-between border-l-8 border-plate-red p-4">
            <span className="font-display text-3xl">헬스</span>
            <span className="text-xs text-steel-400">{gym ? since(gym.startedAt) : "종목 · 세트 · 휴식 타이머"}</span>
            {gym && <span className="dg-chip self-start bg-plate-red text-white">진행 중</span>}
          </Link>
          <Link to="/run" className="dg-steel dg-lift flex min-h-[132px] flex-col justify-between border-l-8 border-plate-blue p-4">
            <span className="font-display text-3xl">러닝</span>
            <span className="text-xs text-steel-400">{run ? since(run.startedAt) : "GPS로 거리 · 페이스"}</span>
            {run && <span className="dg-chip self-start bg-plate-blue text-white">달리는 중</span>}
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">내 운동</h2>
            {activities && activities.length > 0 && (
              <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing} className="text-xs text-steel-400 underline underline-offset-4">
                {editing ? "편집 끝" : "편집"}
              </button>
            )}
          </div>
          {activities === null ? (
            <p className="text-sm text-steel-400" role="status">
              불러오는 중
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activities.map((a) => {
                const live = activeActivity?.activityId === a.id;
                return editing ? (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setRemoving(a)}
                    className="dg-steel flex min-h-[96px] flex-col justify-between border-l-8 border-steel-600 p-4 text-left"
                    aria-label={`${a.name} 빼기`}
                  >
                    <span className="font-display text-2xl">{a.name}</span>
                    <span className="text-xs font-semibold text-red-300">빼기</span>
                  </button>
                ) : (
                  <Link key={a.id} to={`/activity/${a.id}`} className="dg-steel dg-lift flex min-h-[96px] flex-col justify-between border-l-8 border-plate-green p-4">
                    <span className="font-display text-2xl">{a.name}</span>
                    <span className="text-xs text-steel-400">{live ? since(activeActivity.startedAt) : `${CATEGORY_LABEL[a.category]} · 시간 + 메모`}</span>
                    {live && <span className="dg-chip self-start bg-plate-green text-black">진행 중</span>}
                  </Link>
                );
              })}
              {!editing && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-steel-600 p-4 text-steel-300 hover:border-steel-400 hover:text-white"
                >
                  <span className="font-display text-2xl">+ 운동 추가</span>
                  <span className="text-xs">필라테스 · 수영 …</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <DialogFrame open={addOpen} onClose={() => setAddOpen(false)} title="운동 추가" busy={saving}>
        <form onSubmit={(e) => void submitAdd(e)} className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-steel-300">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_ACTIVITY_NAME}
              placeholder="예: 필라테스"
              className="dg-well min-h-[44px] w-full px-3 text-white"
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-1.5" aria-label="예시">
            {ACTIVITY_EXAMPLES.filter((x) => !activities?.some((a) => a.name === x.name)).map((x) => (
              <button
                key={x.name}
                type="button"
                onClick={() => {
                  setName(x.name);
                  setCategory(x.category);
                }}
                className="dg-btn dg-btn-steel min-h-[32px] px-2.5 text-xs"
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <span className="text-steel-300">출석에 남을 종류</span>
            <div className="flex gap-2" role="radiogroup" aria-label="종류">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`dg-btn min-h-[36px] flex-1 text-xs ${category === c ? "dg-btn-primary" : "dg-btn-steel"}`}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-steel-400">추가한 운동은 시간 + 메모만 기록해요.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddOpen(false)} disabled={saving} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              취소
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              {saving ? "추가 중..." : "추가"}
            </button>
          </div>
        </form>
      </DialogFrame>

      <DialogFrame open={removing !== null} onClose={() => setRemoving(null)} title={`${removing?.name ?? ""}을(를) 뺄까요?`} tone="danger">
        <div className="space-y-3 text-sm">
          <p className="text-steel-300">고르는 목록에서만 빠지고, 지난 기록은 남아요.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRemoving(null)} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              취소
            </button>
            <button type="button" onClick={() => void confirmRemove()} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              빼기
            </button>
          </div>
        </div>
      </DialogFrame>
    </section>
  );
}
