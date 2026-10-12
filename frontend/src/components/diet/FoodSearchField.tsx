import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "../../lib/api";
import { FOOD_DATA_CREDIT, FOOD_SOURCE_LABEL, type FoodHit } from "../../lib/foodSearch";

// 음식 이름 칸 + 검색 목록(공공 영양 DB). 글자를 치면 잠깐 뒤 /api/diet/foods 를 부르고, 고르면 onPick.
// 목록은 칸 바로 아래에 붙는다(창 안에서 잘리지 않게 띄우지 않음). ↑ ↓ 로 고르고 Enter 로 확정, Esc 는 목록만 닫는다.

const fmt = (n: number | null) => (n == null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1));

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (food: FoodHit) => void;
  /** 고친 기록이거나 이미 고른 음식이 있으면 검색하지 않는다 */
  searchEnabled: boolean;
  className: string;
};

export default function FoodSearchField({ id, value, onChange, onPick, searchEnabled, className }: Props) {
  const [items, setItems] = useState<FoodHit[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const q = value.trim();

  useEffect(() => {
    if (!searchEnabled || q.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .get<{ ready: boolean; items: FoodHit[] }>("/api/diet/foods", { params: { q: q.slice(0, 40) } })
        .then((res) => {
          if (cancelled) return;
          setReady(res.data.ready);
          setItems(Array.isArray(res.data.items) ? res.data.items : []);
          setActive(-1);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, searchEnabled]);

  const showList = searchEnabled && open && q.length > 0;

  const pick = (food: FoodHit) => {
    setOpen(false);
    setActive(-1);
    onPick(food);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length > 0) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      // 창 전체가 닫히지 않게 목록만 닫는다
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        id={id}
        value={value}
        maxLength={60}
        role={searchEnabled ? "combobox" : undefined}
        aria-expanded={searchEnabled ? showList : undefined}
        aria-controls={searchEnabled ? listId : undefined}
        aria-autocomplete={searchEnabled ? "list" : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="예: 하림 닭가슴살, 현미밥"
        className={className}
      />
      {showList && (
        <div className="dg-well space-y-1 p-1.5">
          {loading && items.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-steel-400" role="status">
              찾는 중이에요.
            </p>
          ) : !ready ? (
            <p className="px-2 py-1.5 text-xs text-steel-400" role="status">
              음식 목록을 준비하고 있어요. 잠시 뒤에 다시 찾아 주세요. 지금은 직접 적어도 돼요.
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-steel-400" role="status">
              찾는 음식이 없어요. 이름과 영양소를 직접 적어 주세요.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="찾은 음식" className="max-h-56 space-y-1 overflow-y-auto">
              {items.map((food, i) => (
                <li
                  key={food.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // 칸의 포커스를 잃기 전에 고르게(mousedown)
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(food);
                  }}
                  className={`cursor-pointer rounded px-2 py-1.5 ${i === active ? "bg-steel-600" : "hover:bg-steel-700"}`}
                >
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-chalk">
                    <span className="flex-none rounded-sm bg-steel-800 px-1.5 text-[11px] font-bold text-steel-300">{FOOD_SOURCE_LABEL[food.source]}</span>
                    <span className="truncate">
                      {food.name}
                      {food.maker && <span className="ml-1.5 font-normal text-steel-400">{food.maker}</span>}
                    </span>
                  </p>
                  <p className="font-num text-xs text-steel-400">
                    {food.basis}당 {fmt(food.kcal)}kcal · 단백질 {fmt(food.proteinG)}g · 탄수화물 {fmt(food.carbG)}g · 지방 {fmt(food.fatG)}g
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="px-2 pb-0.5 text-[11px] text-steel-500">{FOOD_DATA_CREDIT}</p>
        </div>
      )}
    </div>
  );
}
