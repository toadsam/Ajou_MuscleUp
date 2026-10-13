// 식단 "내 음식" — 검색에 없는 음식을 이름 · 양 · 영양소 그대로 저장해 두고 다시 넣는다(서버 /api/diet/my-foods).
// 한 번 불러와 음식 추가 창 · 검색 목록이 같이 쓴다.
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

export type MyFood = {
  id: number;
  name: string;
  amount: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
};

export type MyFoodInput = Omit<MyFood, "id">;

let foods: MyFood[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setFoods(list: MyFood[]) {
  foods = [...list].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  listeners.forEach((fn) => fn());
}

export function loadMyFoods(force = false) {
  if (!loaded || force) {
    loaded = api
      .get<MyFood[]>("/api/diet/my-foods")
      .then((res) => setFoods(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        loaded = null;
      });
  }
  return loaded;
}

export function useMyFoods() {
  useEffect(() => {
    void loadMyFoods();
  }, []);
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => foods,
  );
}

/** 저장(같은 이름이 있으면 서버가 새 값으로 바꾼다) */
export async function saveMyFood(input: MyFoodInput) {
  const res = await api.post<MyFood>("/api/diet/my-foods", input);
  setFoods([...foods.filter((f) => f.id !== res.data.id), res.data]);
  return res.data;
}

export async function deleteMyFood(id: number) {
  await api.delete(`/api/diet/my-foods/${id}`);
  setFoods(foods.filter((f) => f.id !== id));
}

const flat = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 검색어가 들어간 내 음식(최대 5개) */
export const matchMyFoods = (list: MyFood[], q: string) => {
  const key = flat(q);
  return key ? list.filter((f) => flat(f.name).includes(key)).slice(0, 5) : [];
};
