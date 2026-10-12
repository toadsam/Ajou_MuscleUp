import { useMemo, useState } from "react";
import { LIFT_CATEGORY_LABEL, LIFT_EXERCISES, type LiftCategory, type LiftExerciseInfo } from "../../lib/lifts";

type Props = {
  /** 고른 종목(빠른 기록처럼 하나만 고를 때 눌린 상태로 보여 줌) */
  selected?: string | null;
  onPick: (exercise: LiftExerciseInfo) => void;
  /** 맨몸 종목 빼기(빠른 기록은 무게가 있어야 해서) */
  weightedOnly?: boolean;
  /** 이미 세션에 넣은 종목(흐리게) */
  disabledCodes?: string[];
};

const CATEGORIES = Object.keys(LIFT_CATEGORY_LABEL) as LiftCategory[];

/** 부위 칩 + 이름 검색 + 종목 버튼. 운동 세션 "종목 추가"와 빠른 기록이 같이 쓴다 */
export default function ExercisePicker({ selected, onPick, weightedOnly = false, disabledCodes = [] }: Props) {
  const [category, setCategory] = useState<LiftCategory | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.replace(/\s+/g, "");
    return LIFT_EXERCISES.filter(
      (e) =>
        (!weightedOnly || !e.bodyweight) &&
        (category === "ALL" || e.category === category) &&
        (!q || e.label.replace(/\s+/g, "").includes(q)),
    );
  }, [category, query, weightedOnly]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="종목 이름으로 찾기"
        aria-label="종목 이름으로 찾기"
        className="dg-well w-full px-3 py-2 text-sm text-white"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="부위">
        {(["ALL", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`dg-btn min-h-[34px] px-3 text-xs ${category === c ? "dg-btn-primary" : "dg-btn-steel"}`}
          >
            {c === "ALL" ? "전체" : LIFT_CATEGORY_LABEL[c]}
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
              className={`dg-btn min-h-[44px] px-2 text-sm disabled:opacity-40 ${selected === e.code ? "dg-btn-primary" : "dg-btn-steel"}`}
            >
              {e.label}
              {e.bodyweight && <span className="ml-1 text-[11px] text-steel-400">맨몸</span>}
            </button>
          );
        })}
        {items.length === 0 && <p className="col-span-full text-sm text-steel-400">찾는 종목이 없어요.</p>}
      </div>
    </div>
  );
}
