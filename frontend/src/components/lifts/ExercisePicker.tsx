import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { friendlyError } from "../../lib/httpError";
import {
  LIFT_CATEGORY_LABEL,
  LIFT_EXERCISES,
  addCustomExercise,
  deleteCustomExercise,
  useCustomExercises,
  type LiftCategory,
  type LiftExerciseInfo,
} from "../../lib/lifts";

type Props = {
  /** 고른 종목(빠른 기록처럼 하나만 고를 때 눌린 상태로 보여 줌) */
  selected?: string | null;
  onPick: (exercise: LiftExerciseInfo) => void;
  /** 맨몸 종목 빼기(빠른 기록은 무게가 있어야 해서) */
  weightedOnly?: boolean;
  /** 이미 세션에 넣은 종목(흐리게) */
  disabledCodes?: string[];
};

type Tab = "RECENT" | "ALL" | "MINE" | LiftCategory;

const BODY_PARTS: LiftCategory[] = ["LEGS", "CHEST", "BACK", "SHOULDERS", "ARMS", "CORE"];
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 종목 고르기 — 운동 세션 "종목 추가"와 빠른 기록이 같이 쓴다.
 * 맨 위 "최근"(최근에 한 종목 8개) → 전체 → 부위 → 내 종목. 이름으로 찾으면 모든 종목에서.
 * 목록에 없으면 맨 아래 "직접 추가"(이름 · 부위 · 맨몸) — 추가하면 바로 고른 것으로 넘긴다.
 */
export default function ExercisePicker({ selected, onPick, weightedOnly = false, disabledCodes = [] }: Props) {
  const customs = useCustomExercises();
  const [tab, setTab] = useState<Tab>("ALL");
  const [touched, setTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [part, setPart] = useState<LiftCategory>("OTHER");
  const [bodyweight, setBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);

  // 최근에 한 종목이 있으면 그걸 먼저 보여 준다
  useEffect(() => {
    let alive = true;
    api
      .get<LiftExerciseInfo[]>("/api/lifts/recent")
      .then((res) => {
        if (!alive) return;
        setRecentCodes(res.data.map((e) => e.code));
        if (res.data.length > 0) setTab((t) => (t === "ALL" ? "RECENT" : t));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(() => [...LIFT_EXERCISES, ...customs], [customs]);

  const items = useMemo(() => {
    const usable = (e: LiftExerciseInfo) => !weightedOnly || !e.bodyweight;
    const q = norm(query);
    if (q) return all.filter((e) => usable(e) && norm(e.label).includes(q));
    if (tab === "RECENT") {
      return recentCodes.map((c) => all.find((e) => e.code === c)).filter((e): e is LiftExerciseInfo => Boolean(e) && usable(e!));
    }
    if (tab === "MINE") return customs.filter(usable);
    return all.filter((e) => usable(e) && (tab === "ALL" || e.category === tab));
  }, [all, customs, query, recentCodes, tab, weightedOnly]);

  const showRecent = recentCodes.length > 0;
  const hasOther = customs.some((e) => e.category === "OTHER");
  const tabs: Tab[] = [
    ...(showRecent ? (["RECENT"] as Tab[]) : []),
    "ALL",
    ...BODY_PARTS,
    ...(hasOther ? (["OTHER"] as Tab[]) : []),
    ...(customs.length > 0 ? (["MINE"] as Tab[]) : []),
  ];
  const tabLabel = (t: Tab) => (t === "RECENT" ? "최근" : t === "ALL" ? "전체" : t === "MINE" ? "내 종목" : LIFT_CATEGORY_LABEL[t]);

  const openAdd = () => {
    setName(query.trim());
    setPart(tab !== "RECENT" && tab !== "ALL" && tab !== "MINE" ? tab : "OTHER");
    setBodyweight(false);
    setAdding(true);
  };

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const created = await addCustomExercise(name.trim(), part, weightedOnly ? false : bodyweight);
      toast(`"${created.label}"을(를) 내 종목에 추가했어요.`, "success");
      setAdding(false);
      setQuery("");
      onPick(created);
    } catch (err: unknown) {
      toast(friendlyError(err, "추가하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ex: LiftExerciseInfo) => {
    if (!window.confirm(`"${ex.label}"을(를) 내 종목에서 지울까요? 지난 기록은 그대로 남아요.`)) return;
    try {
      await deleteCustomExercise(ex.code);
      setRecentCodes((codes) => codes.filter((c) => c !== ex.code));
    } catch (err: unknown) {
      toast(friendlyError(err, "지우지 못했어요."), "error");
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="종목 이름으로 찾기"
        aria-label="종목 이름으로 찾기"
        className="dg-well w-full px-3 py-2.5 text-base text-white"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="부위">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t && !query}
            onClick={() => {
              setTab(t);
              setTouched(true);
              setQuery("");
            }}
            className={`dg-btn min-h-[38px] px-3 text-sm ${tab === t && !query ? "dg-btn-primary" : "dg-btn-steel"}`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((e) => {
          const used = disabledCodes.includes(e.code);
          return (
            <button
              key={e.code}
              type="button"
              aria-pressed={selected === e.code}
              disabled={used}
              onClick={() => onPick(e)}
              className={`dg-btn min-h-[52px] px-2 text-[15px] leading-tight disabled:opacity-40 ${
                selected === e.code ? "dg-btn-primary" : "dg-btn-steel"
              }`}
            >
              <span>
                {e.label}
                {(e.bodyweight || e.custom) && (
                  <span className="block text-[11px] font-normal text-steel-400">
                    {[e.custom ? "내 종목" : null, e.bodyweight ? "맨몸" : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full text-sm text-steel-400">
            {query ? `"${query}"은(는) 목록에 없어요. 아래에서 직접 추가해 주세요.` : touched && tab === "RECENT" ? "최근에 한 종목이 없어요." : "종목이 없어요."}
          </p>
        )}
      </div>

      {tab === "MINE" && !query && customs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {customs.map((e) => (
            <li key={e.code} className="flex items-center justify-between gap-2 text-steel-300">
              <span className="truncate">
                {e.label} <span className="text-xs text-steel-500">{LIFT_CATEGORY_LABEL[e.category]}</span>
              </span>
              <button type="button" onClick={() => void remove(e)} className="flex-none text-xs text-steel-400 underline underline-offset-4">
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={submitAdd} className="dg-well space-y-3 p-3">
          <p className="text-sm font-semibold">직접 추가</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="종목 이름(예: 케이블 풀오버)"
            aria-label="종목 이름"
            autoFocus
            className="dg-well w-full px-3 py-2 text-base text-white"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="부위 고르기">
            {[...BODY_PARTS, "OTHER" as LiftCategory].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={part === c}
                onClick={() => setPart(c)}
                className={`dg-btn min-h-[34px] px-3 text-xs ${part === c ? "dg-btn-primary" : "dg-btn-steel"}`}
              >
                {LIFT_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {!weightedOnly && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bodyweight} onChange={(e) => setBodyweight(e.target.checked)} className="h-5 w-5" />
              맨몸 운동(무게 없이 횟수만)
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="dg-btn dg-btn-steel min-h-[44px] flex-1 text-sm">
              취소
            </button>
            <button type="submit" disabled={!name.trim() || saving} className="dg-btn dg-btn-primary min-h-[44px] flex-1 text-sm">
              {saving ? "추가 중..." : "추가"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={openAdd} className="dg-btn dg-btn-steel min-h-[44px] w-full text-sm">
          + 찾는 종목이 없나요? 직접 추가
        </button>
      )}
    </div>
  );
}
