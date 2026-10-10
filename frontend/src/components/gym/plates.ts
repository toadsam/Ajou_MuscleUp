// 바벨 원판 규격 — 국제 대회 규격 색(빨강 25 · 파랑 20 · 노랑 15 · 초록 10 · 흰색 5)

export type PlateSpec = {
  kg: number;
  color: string;
  ink: string;
  width: number;
  /** 큰 원판 대비 지름 비율 */
  scale: number;
};

export const PLATE_ORDER: PlateSpec[] = [
  { kg: 25, color: "#D9302A", ink: "#FFFFFF", width: 26, scale: 1 },
  { kg: 20, color: "#2F6FD0", ink: "#FFFFFF", width: 23, scale: 1 },
  { kg: 15, color: "#F0BE2E", ink: "#0E0E10", width: 20, scale: 1 },
  { kg: 10, color: "#2E9C55", ink: "#FFFFFF", width: 17, scale: 1 },
  { kg: 5, color: "#E8E6E0", ink: "#0E0E10", width: 14, scale: 0.62 },
  { kg: 2.5, color: "#D9302A", ink: "#FFFFFF", width: 12, scale: 0.5 },
  { kg: 1.25, color: "#B8BBC0", ink: "#0E0E10", width: 10, scale: 0.42 },
];

export const BAR_KG = 20;

export function barbellWeight(loaded: number, slots = PLATE_ORDER.length) {
  const count = Math.max(0, Math.min(loaded, slots));
  return BAR_KG + PLATE_ORDER.slice(0, count).reduce((sum, plate) => sum + plate.kg * 2, 0);
}
