// 러닝 공유 카드 내용 — 그리기는 lib/photoCard.ts(출석 공유와 같은 모양).
import { formatKm, formatPace, type LatLng } from "./running";
import { formatClock } from "./workoutSession";
import { dotDate, type PhotoCardContent } from "./photoCard";

export type RunShareData = {
  distanceM: number;
  durationSec: number;
  paceSec: number | null;
  /** 시작 시각(ISO 또는 ms) */
  startedAt: string | number;
  route: LatLng[] | null;
};

export type RunShow = { distance: boolean; pace: boolean; time: boolean; route: boolean; date: boolean };

export const RUN_TOGGLES: { key: keyof RunShow; label: string }[] = [
  { key: "distance", label: "거리" },
  { key: "pace", label: "페이스" },
  { key: "time", label: "시간" },
  { key: "route", label: "코스" },
  { key: "date", label: "날짜" },
];

function partOfDay(startedAt: string | number) {
  const h = new Date(startedAt).getHours();
  return h < 5 ? "새벽" : h < 11 ? "아침" : h < 16 ? "낮" : h < 20 ? "저녁" : "밤";
}

export function runCardContent(d: RunShareData, s: RunShow): PhotoCardContent {
  return {
    kicker: s.date ? `${dotDate(d.startedAt)} ${partOfDay(d.startedAt)} 러닝` : null,
    headline: s.distance ? { value: formatKm(d.distanceM), label: "킬로미터" } : null,
    stats: [
      s.pace ? { label: "평균 페이스", value: formatPace(d.paceSec) } : null,
      s.time ? { label: "시간", value: formatClock(d.durationSec) } : null,
    ].filter(Boolean) as { label: string; value: string }[],
    route: s.route ? d.route : null,
  };
}
