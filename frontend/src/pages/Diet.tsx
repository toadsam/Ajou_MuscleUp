import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import FoodSearchField from "../components/diet/FoodSearchField";
import { FOOD_SOURCE_LABEL, type FoodHit } from "../lib/foodSearch";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";

// 식단 기록(PR A). 하루 단위로 끼니별 음식을 적고, 하루 합계를 목표와 비교한다.
// 사진 인식(PR B)은 같은 기록에 "사진에서 찾은 음식"을 확인 뒤 저장하는 방식으로 붙는다.

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

type Entry = {
  id: number;
  date: string;
  mealType: MealType;
  name: string;
  amount: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  source: "MANUAL" | "PHOTO";
};

type Totals = { kcal: number; proteinG: number; carbG: number; fatG: number; count: number };

type Goal = {
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  source: "MANUAL" | "INBODY" | "BODY_STATS";
  saved: boolean;
};

type DayView = { date: string; today: string; entries: Entry[]; totals: Totals; goal: Goal | null };
type DaySummary = { date: string; totals: Totals };
type RecentFood = Omit<Entry, "id" | "date" | "mealType" | "source">;

const MEALS: { key: MealType; label: string }[] = [
  { key: "BREAKFAST", label: "아침" },
  { key: "LUNCH", label: "점심" },
  { key: "DINNER", label: "저녁" },
  { key: "SNACK", label: "간식" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const fieldClass =
  "dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";

// "YYYY-MM-DD" 를 시간대 영향 없이 다룬다(서버가 한국 날짜로 준 값을 그대로 쓴다)
function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dateLabel(iso: string, today: string | null) {
  if (today && iso === today) return "오늘";
  if (today && iso === shiftDate(today, -1)) return "어제";
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
}

const fmt = (n: number | null | undefined) => (n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function Diet() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("date");
  const [day, setDay] = useState<DayView | null>(null);
  const [week, setWeek] = useState<DaySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ mealType: MealType; entry?: Entry } | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const today = day?.today ?? null;
  const date = requested ?? today;

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<DayView>("/api/diet/day", { params: requested ? { date: requested } : {} });
      setDay(res.data);
      // 7일 막대는 보고 있는 날을 끝으로
      const sum = await api.get<DaySummary[]>("/api/diet/summary", { params: { to: res.data.date } });
      setWeek(sum.data);
    } catch (e) {
      setError(friendlyError(e, "식단 기록을 불러오지 못했어요."));
    }
  }, [requested]);

  useEffect(() => {
    void load();
  }, [load]);

  const goTo = (iso: string) => {
    if (today && iso > today) return;
    setParams(iso === today ? {} : { date: iso }, { replace: true });
  };

  const removeEntry = async (entry: Entry) => {
    if (busyId !== null) return;
    if (!window.confirm(`"${entry.name}" 기록을 지울까요?`)) return;
    setBusyId(entry.id);
    try {
      await api.delete(`/api/diet/entries/${entry.id}`);
      toast("지웠어요.", "success");
      await load();
    } catch (e) {
      toast(friendlyError(e, "지우지 못했어요."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const byMeal = useMemo(() => {
    const map = new Map<MealType, Entry[]>();
    for (const e of day?.entries ?? []) {
      const list = map.get(e.mealType) ?? [];
      list.push(e);
      map.set(e.mealType, list);
    }
    return map;
  }, [day]);

  const viewingToday = !!day && day.date === day.today;

  return (
    <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-bold text-plate-yellow">식단 기록</p>
          <h1 className="text-3xl md:text-4xl">오늘 뭐 먹었어요?</h1>
          <p className="text-sm text-steel-400">먹은 음식을 끼니별로 적으면 하루 칼로리와 단백질을 목표와 비교해 줘요. 기록은 나만 볼 수 있어요.</p>
        </header>

        {/* 날짜 고르기 */}
        <nav className="flex items-center justify-between gap-2" aria-label="날짜 고르기">
          <button
            type="button"
            onClick={() => date && goTo(shiftDate(date, -1))}
            disabled={!date}
            className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm"
          >
            <span aria-hidden>‹</span> 이전 날
          </button>
          <div className="text-center">
            <p className="font-display text-xl" aria-live="polite">
              {date ? dateLabel(date, today) : "불러오는 중"}
            </p>
            {day && !viewingToday && (
              <button type="button" onClick={() => goTo(day.today)} className="text-xs font-semibold text-plate-yellow underline underline-offset-4">
                오늘로
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => date && goTo(shiftDate(date, 1))}
            disabled={!date || viewingToday}
            className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm disabled:opacity-40"
          >
            다음 날 <span aria-hidden>›</span>
          </button>
        </nav>

        {error ? (
          <div className="dg-steel flex flex-wrap items-center gap-3 p-5">
            <p role="alert" className="text-sm font-semibold text-red-300">
              {error}
            </p>
            <button type="button" onClick={() => void load()} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
              다시 시도
            </button>
          </div>
        ) : !day ? (
          <div className="dg-steel p-5" role="status">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : (
          <>
            <GoalBoard totals={day.totals} goal={day.goal} onEditGoal={() => setGoalOpen(true)} />

            <div className="space-y-4">
              {MEALS.map((meal) => {
                const list = byMeal.get(meal.key) ?? [];
                const kcal = list.reduce((s, e) => s + (e.kcal ?? 0), 0);
                return (
                  <section key={meal.key} className="dg-steel space-y-3 p-4 md:p-5" aria-labelledby={`meal-${meal.key}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 id={`meal-${meal.key}`} className="font-display text-xl">
                        {meal.label}
                        {list.length > 0 && <span className="ml-2 font-num text-base text-steel-400">{kcal} kcal</span>}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setEditing({ mealType: meal.key })}
                        className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
                      >
                        + {meal.label} 추가
                      </button>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-sm text-steel-500">아직 기록이 없어요.</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map((entry) => (
                          <li key={entry.id} className="dg-well flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-chalk">
                                {entry.name}
                                {entry.amount && <span className="ml-2 text-sm font-normal text-steel-400">{entry.amount}</span>}
                              </p>
                              <p className="font-num text-xs text-steel-400">
                                {fmt(entry.kcal)} kcal · 단백질 {fmt(entry.proteinG)}g · 탄수화물 {fmt(entry.carbG)}g · 지방 {fmt(entry.fatG)}g
                              </p>
                            </div>
                            <div className="flex flex-none gap-2">
                              <button
                                type="button"
                                onClick={() => setEditing({ mealType: entry.mealType, entry })}
                                className="min-h-[36px] px-2 text-xs font-semibold text-steel-300 underline underline-offset-4 hover:text-white"
                              >
                                고치기
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeEntry(entry)}
                                disabled={busyId !== null}
                                className="min-h-[36px] px-2 text-xs font-semibold text-steel-400 underline underline-offset-4 hover:text-red-300"
                              >
                                {busyId === entry.id ? "지우는 중" : "지우기"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>

            {week && <WeekChart days={week} selected={day.date} goal={day.goal} onPick={goTo} />}
          </>
        )}
      </div>

      {editing && day && (
        <EntryDialog
          date={day.date}
          mealType={editing.mealType}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {goalOpen && day && (
        <GoalDialog
          goal={day.goal}
          onClose={() => setGoalOpen(false)}
          onSaved={() => {
            setGoalOpen(false);
            void load();
          }}
        />
      )}
    </section>
  );
}

// ---- 목표 대비 하루 합계 ----

function GoalBoard({ totals, goal, onEditGoal }: { totals: Totals; goal: Goal | null; onEditGoal: () => void }) {
  const rows: { label: string; unit: string; value: number; target: number | null; bar: string }[] = [
    { label: "칼로리", unit: "kcal", value: totals.kcal, target: goal?.saved ? goal.kcal : null, bar: "bg-plate-blue" },
    { label: "단백질", unit: "g", value: totals.proteinG, target: goal?.proteinG ?? null, bar: "bg-plate-yellow" },
    { label: "탄수화물", unit: "g", value: totals.carbG, target: goal?.saved ? goal.carbG : null, bar: "bg-plate-green" },
    { label: "지방", unit: "g", value: totals.fatG, target: goal?.saved ? goal.fatG : null, bar: "bg-steel-300" },
  ];

  return (
    <section className="dg-steel space-y-4 p-4 md:p-5" aria-labelledby="diet-goal-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="diet-goal-title" className="font-display text-xl">
            하루 합계
          </h2>
          <p className="mt-1 text-xs text-steel-400">
            {goal?.saved
              ? goal.source === "INBODY"
                ? "인바디 분석에서 가져온 목표와 비교해요."
                : "내가 정한 목표와 비교해요."
              : goal
                ? "체중 기준 단백질 제안(체중 × 1.6g)과 비교해요. 목표를 정하면 칼로리도 볼 수 있어요."
                : "목표를 정하면 얼마나 채웠는지 보여 줘요."}
          </p>
        </div>
        <button type="button" onClick={onEditGoal} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
          {goal?.saved ? "목표 바꾸기" : "목표 정하기"}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((row) => {
          const pct = row.target && row.target > 0 ? Math.round((row.value / row.target) * 100) : null;
          return (
            <div key={row.label} className="dg-well space-y-2 px-3 py-3">
              <dt className="text-xs font-bold text-steel-400">{row.label}</dt>
              <dd>
                <span className="font-num text-2xl font-black text-white">{fmt(row.value)}</span>
                <span className="ml-1 text-xs font-bold text-steel-400">
                  {row.target ? `/ ${row.target}${row.unit}` : row.unit}
                </span>
              </dd>
              {pct !== null && (
                <div
                  className="h-2 overflow-hidden rounded-sm bg-steel-800"
                  role="progressbar"
                  aria-label={`${row.label} 목표의 ${pct}%`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(pct, 100)}
                >
                  <div className={`h-full ${pct > 110 ? "bg-plate-red" : row.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              )}
              {pct !== null && <p className="font-num text-xs text-steel-400">{pct}%</p>}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// ---- 최근 7일 ----

function WeekChart({ days, selected, goal, onPick }: { days: DaySummary[]; selected: string; goal: Goal | null; onPick: (iso: string) => void }) {
  const proteinTarget = goal?.proteinG ?? null;
  const max = Math.max(1, proteinTarget ?? 0, ...days.map((d) => d.totals.proteinG));
  return (
    <section className="dg-steel space-y-3 p-4 md:p-5" aria-labelledby="diet-week-title">
      <h2 id="diet-week-title" className="font-display text-xl">
        최근 7일 단백질
      </h2>
      <div className="flex h-36 items-end gap-2" role="list">
        {days.map((d) => {
          const h = Math.round((d.totals.proteinG / max) * 100);
          const on = d.date === selected;
          const hit = proteinTarget !== null && d.totals.proteinG >= proteinTarget;
          const [, m, dd] = d.date.split("-").map(Number);
          return (
            <button
              key={d.date}
              type="button"
              role="listitem"
              onClick={() => onPick(d.date)}
              aria-label={`${m}월 ${dd}일 단백질 ${fmt(d.totals.proteinG)}g, 칼로리 ${d.totals.kcal}kcal`}
              aria-current={on ? "date" : undefined}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="font-num text-[11px] text-steel-400">{d.totals.count > 0 ? Math.round(d.totals.proteinG) : ""}</span>
              <span
                className={`w-full rounded-t-sm border-2 border-black ${hit ? "bg-plate-green" : "bg-plate-yellow"} ${on ? "" : "opacity-60"}`}
                style={{ height: `${Math.max(h, d.totals.count > 0 ? 4 : 0)}%` }}
              />
              <span className={`font-num text-xs ${on ? "font-black text-white" : "text-steel-400"}`}>{dd}</span>
            </button>
          );
        })}
      </div>
      {proteinTarget !== null && <p className="text-xs text-steel-400">초록 막대는 단백질 {proteinTarget}g을 채운 날이에요.</p>}
    </section>
  );
}

// ---- 기록 추가 · 고치기 ----

type NumField = "kcal" | "proteinG" | "carbG" | "fatG";
const NUM_FIELDS: { key: NumField; label: string; unit: string; max: number }[] = [
  { key: "kcal", label: "칼로리", unit: "kcal", max: 5000 },
  { key: "proteinG", label: "단백질", unit: "g", max: 500 },
  { key: "carbG", label: "탄수화물", unit: "g", max: 500 },
  { key: "fatG", label: "지방", unit: "g", max: 500 },
];

function EntryDialog({
  date,
  mealType: initialMeal,
  entry,
  onClose,
  onSaved,
}: {
  date: string;
  mealType: MealType;
  entry?: Entry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<MealType>(initialMeal);
  const [name, setName] = useState(entry?.name ?? "");
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [nums, setNums] = useState<Record<NumField, string>>({
    kcal: entry?.kcal != null ? String(entry.kcal) : "",
    proteinG: entry?.proteinG != null ? String(entry.proteinG) : "",
    carbG: entry?.carbG != null ? String(entry.carbG) : "",
    fatG: entry?.fatG != null ? String(entry.fatG) : "",
  });
  const [recent, setRecent] = useState<RecentFood[]>([]);
  // 검색에서 고른 음식(100g · 100ml 기준 값)과 먹은 양 — 양을 바꾸면 영양소를 다시 계산한다
  const [food, setFood] = useState<FoodHit | null>(null);
  const [portion, setPortion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const amountId = useId();
  const portionId = useId();
  const baseId = useId();

  useEffect(() => {
    if (entry) return;
    let cancelled = false;
    api
      .get<RecentFood[]>("/api/diet/recent-foods")
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setRecent(res.data.slice(0, 8));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const unitOf = (f: FoodHit) => (f.basis === "100ml" ? "ml" : "g");

  const applyPortion = (f: FoodHit, value: string) => {
    setPortion(value);
    const g = Number(value);
    if (!value.trim() || !Number.isFinite(g) || g <= 0) return;
    const factor = g / 100;
    const scaled = (v: number | null, digits: number) => (v == null ? "" : String(Math.round(v * factor * 10 ** digits) / 10 ** digits));
    setAmount(`${Math.round(g * 10) / 10}${unitOf(f)}`);
    setNums({ kcal: scaled(f.kcal, 0), proteinG: scaled(f.proteinG, 1), carbG: scaled(f.carbG, 1), fatG: scaled(f.fatG, 1) });
  };

  const pickFood = (f: FoodHit) => {
    setFood(f);
    // 제품은 "하림 닭가슴살"처럼 업체를 앞에 — 이름에 이미 업체 이름(첫 단어)이 있으면 붙이지 않는다
    const brand = f.source === "PROCESSED" && f.maker ? f.maker.split(" ")[0] : "";
    const flat = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    setName((brand && !flat(f.name).includes(flat(brand)) ? `${brand} ${f.name}` : f.name).slice(0, 60));
    // 기본 양: 한 번에 먹을 만한 포장(500 이하)이면 포장 전체 → 1회 섭취참고량 · 1인분 → 100.
    // (1회 섭취참고량은 식품 분류별 기준량이라 100g 닭가슴살 한 팩도 30g 으로 나온다 — 포장을 먼저 본다)
    applyPortion(f, String(f.packageG && f.packageG <= 500 ? f.packageG : (f.servingG ?? 100)));
  };

  const fillFrom = (food: RecentFood) => {
    setFood(null);
    setName(food.name);
    setAmount(food.amount ?? "");
    setNums({
      kcal: food.kcal != null ? String(food.kcal) : "",
      proteinG: food.proteinG != null ? String(food.proteinG) : "",
      carbG: food.carbG != null ? String(food.carbG) : "",
      fatG: food.fatG != null ? String(food.fatG) : "",
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("음식 이름을 적어 주세요.");
      return;
    }
    const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
    const body = {
      date,
      mealType,
      name: name.trim(),
      amount: amount.trim() || null,
      kcal: toNum(nums.kcal) == null ? null : Math.round(Number(nums.kcal)),
      proteinG: toNum(nums.proteinG),
      carbG: toNum(nums.carbG),
      fatG: toNum(nums.fatG),
    };
    setSaving(true);
    setError(null);
    try {
      if (entry) await api.put(`/api/diet/entries/${entry.id}`, body);
      else await api.post("/api/diet/entries", body);
      toast(entry ? "고쳤어요." : "기록했어요.", "success");
      onSaved();
    } catch (e) {
      setError(friendlyError(e, "저장하지 못했어요."));
      setSaving(false);
    }
  };

  return (
    <DialogFrame
      open
      onClose={onClose}
      busy={saving}
      title={entry ? "기록 고치기" : "음식 추가"}
      description={entry ? "이름만 적어도 저장돼요. 칼로리 · 영양소는 아는 만큼만 적어 주세요." : "음식 이름을 치면 찾아서 영양소를 채워 줘요. 없으면 직접 적어도 돼요."}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="끼니">
          {MEALS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mealType === m.key}
              onClick={() => setMealType(m.key)}
              className={`min-h-[36px] rounded-md border-[3px] border-black px-3 text-sm font-bold ${
                mealType === m.key ? "bg-plate-blue text-white" : "bg-steel-700 text-steel-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-steel-400">최근에 먹은 음식</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((food) => (
                <button key={food.name} type="button" onClick={() => fillFrom(food)} className="dg-chip max-w-[10rem] truncate text-xs">
                  {food.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 이름 칸은 검색 목록이 붙으므로 한 줄을 다 쓴다 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 space-y-1">
            <label htmlFor={nameId} className="text-xs font-bold text-steel-300">
              음식 이름
            </label>
            <FoodSearchField id={nameId} value={name} onChange={setName} onPick={pickFood} searchEnabled={!entry && !food} className={fieldClass} />
          </div>
          <div className={`space-y-1 ${food ? "hidden" : ""}`}>
            <label htmlFor={amountId} className="text-xs font-bold text-steel-300">
              양
            </label>
            <input id={amountId} value={amount} maxLength={30} onChange={(e) => setAmount(e.target.value)} placeholder="150g" className={fieldClass} />
          </div>
        </div>

        {food && (
          // 고른 음식: 먹은 양만 바꾸면 아래 칼로리 · 영양소가 다시 계산된다(그 뒤에 숫자를 직접 고쳐도 된다)
          <div className="dg-well space-y-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-xs text-steel-300">
                <span className="mr-1.5 rounded-sm bg-steel-800 px-1.5 font-bold">{FOOD_SOURCE_LABEL[food.source]}</span>
                {food.basis}당 {food.kcal ?? "-"}kcal · 단백질 {food.proteinG ?? "-"}g
              </p>
              <button
                type="button"
                onClick={() => {
                  setFood(null);
                  setPortion("");
                }}
                className="text-xs font-semibold text-steel-400 underline underline-offset-4 hover:text-white"
              >
                다른 음식 찾기
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label htmlFor={portionId} className="text-xs font-bold text-steel-300">
                  먹은 양 ({unitOf(food)})
                </label>
                <input
                  id={portionId}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={5000}
                  step="any"
                  value={portion}
                  onChange={(e) => applyPortion(food, e.target.value)}
                  className={`${fieldClass} font-num w-28`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="양 빠르게 고르기">
                {[
                  ...(food.servingG ? [{ label: `${food.source === "DISH" ? "1인분" : "1회"} ${food.servingG}${unitOf(food)}`, g: food.servingG }] : []),
                  ...(food.packageG && food.packageG !== food.servingG ? [{ label: `1개 ${food.packageG}${unitOf(food)}`, g: food.packageG }] : []),
                  { label: `100${unitOf(food)}`, g: 100 },
                  ...(Number(portion) > 0 ? [{ label: "절반", g: Number(portion) / 2 }, { label: "두 배", g: Number(portion) * 2 }] : []),
                ]
                  // 같은 양 버튼은 하나만(1개 100g · 100g)
                  .filter((opt, i, all) => all.findIndex((o) => o.g === opt.g) === i)
                  .map((opt) => (
                  <button key={opt.label} type="button" onClick={() => applyPortion(food, String(Math.round(opt.g * 10) / 10))} className="dg-chip min-h-[36px] text-xs">
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {NUM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`${baseId}-${f.key}`} className="text-xs font-bold text-steel-300">
                {f.label} ({f.unit})
              </label>
              <input
                id={`${baseId}-${f.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={f.max}
                step={f.key === "kcal" ? 1 : 0.1}
                value={nums[f.key]}
                onChange={(e) => setNums((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className={`${fieldClass} font-num`}
              />
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">
            취소
          </button>
          <button type="submit" disabled={saving} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">
            {saving ? "저장 중" : "저장"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

// ---- 목표 ----

function GoalDialog({ goal, onClose, onSaved }: { goal: Goal | null; onClose: () => void; onSaved: () => void }) {
  const [nums, setNums] = useState<Record<NumField, string>>({
    kcal: goal?.kcal != null ? String(goal.kcal) : "",
    proteinG: goal?.proteinG != null ? String(goal.proteinG) : "",
    carbG: goal?.carbG != null ? String(goal.carbG) : "",
    fatG: goal?.fatG != null ? String(goal.fatG) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const toInt = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
    const body = { kcal: toInt(nums.kcal), proteinG: toInt(nums.proteinG), carbG: toInt(nums.carbG), fatG: toInt(nums.fatG), source: "MANUAL" };
    if (body.kcal == null && body.proteinG == null && body.carbG == null && body.fatG == null) {
      setError("목표를 하나 이상 적어 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/diet/goal", body);
      toast("목표를 저장했어요.", "success");
      onSaved();
    } catch (e) {
      setError(friendlyError(e, "목표를 저장하지 못했어요."));
      setSaving(false);
    }
  };

  const clear = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.delete("/api/diet/goal");
      toast("목표를 지웠어요.", "success");
      onSaved();
    } catch (e) {
      setError(friendlyError(e, "목표를 지우지 못했어요."));
      setSaving(false);
    }
  };

  return (
    <DialogFrame
      open
      onClose={onClose}
      busy={saving}
      title="하루 목표"
      description={
        <>
          아는 것만 적어도 돼요. 인바디 분석 결과가 있으면{" "}
          <Link to="/ai/inbody" className="font-semibold text-plate-yellow underline underline-offset-4">
            인바디 상담
          </Link>
          에서 "식단 목표로 저장"을 눌러 가져올 수 있어요.
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {NUM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`${baseId}-${f.key}`} className="text-xs font-bold text-steel-300">
                {f.label} ({f.unit})
              </label>
              <input
                id={`${baseId}-${f.key}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={nums[f.key]}
                onChange={(e) => setNums((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className={`${fieldClass} font-num`}
              />
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {goal?.saved ? (
            <button type="button" onClick={() => void clear()} disabled={saving} className="text-xs font-semibold text-steel-400 underline underline-offset-4 hover:text-red-300">
              목표 지우기
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm">
              취소
            </button>
            <button type="submit" disabled={saving} className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm">
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      </form>
    </DialogFrame>
  );
}
