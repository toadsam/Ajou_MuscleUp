// 홈 헬스장 꾸미기 — 서버 /api/gym-decor. 물품을 얻었는지는 서버가 기록으로 계산한다.
// 그림 · 자리 위치는 components/gymMap/decor.ts.
import { api } from "./api";
import type { DecorLayout, DecorSlot } from "../components/gymMap/decor";

export type DecorItem = {
  code: string;
  /** DECOR 물품 · THEME 바닥과 벽 · STAFF 새 직원 · LOOK 직원 겉모습 */
  kind: "DECOR" | "THEME" | "STAFF" | "LOOK";
  label: string;
  slots: DecorSlot[];
  multi: boolean;
  owned: boolean;
  progress: number;
  goal: number;
  hint: string;
};

export type DecorView = {
  slots: { slot: DecorSlot; code: string | null }[];
  items: DecorItem[];
  owned: number;
  total: number;
};

export const layoutOf = (view: DecorView): DecorLayout =>
  Object.fromEntries(view.slots.map((s) => [s.slot, s.code])) as DecorLayout;

export const fetchDecor = () => api.get<DecorView>("/api/gym-decor").then((res) => res.data);

export const placeDecor = (slot: DecorSlot, code: string | null) =>
  api.put<DecorView>(`/api/gym-decor/slots/${slot}`, { code }).then((res) => res.data);

// "새 물품" 표시: 이 기기에서 이미 본 물품 코드(편의용 — 지워져도 다시 새 물품으로 보일 뿐)
const SEEN_KEY = "dg.decor.seen";

export function readSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function writeSeen(codes: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(codes));
  } catch {
    // 저장 못 해도 동작에는 상관없다
  }
}

// 첫 꾸미기 물품 안내를 이미 보여 줬는지(이 기기 기준, 한 번만)
const TIP_KEY = "dg.decor.tipShown";

export function readDecorTipShown(): boolean {
  try {
    return window.localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return true; // 저장소를 못 쓰면 매번 뜨지 않게 이미 본 것으로
  }
}

export function writeDecorTipShown() {
  try {
    window.localStorage.setItem(TIP_KEY, "1");
  } catch {
    // 저장 못 해도 동작에는 상관없다
  }
}
