import { useCallback } from "react";
import PhotoShareEditor, { type ShareToggle } from "../share/PhotoShareEditor";
import { dotDate, shareFileName, type PhotoCardContent } from "../../lib/photoCard";

// 그림자 처치 공유 카드(docs/design/shadow-dungeon-map.md 5절) — 러닝 · 출석과 같은 사진 카드(PhotoShareEditor, 캔버스 직접 그림).
// 사진(헬스장 셀카 등)을 깔 수 있고, 워터마크 하나 · 고른 숫자만 얹는다(꾸밈 상자 · 스티커 없음 — CLAUDE.md 공유 카드 규칙).

export type ShadowShareData = {
  weekStart: string;
  weekEnd: string;
  hp: number;
  overkillPct: number;
  streakWeeks: number;
  mobsKilled: number;
};

const TOGGLES: ShareToggle[] = [
  { key: "hp", label: "그림자 체력" },
  { key: "overkill", label: "오버킬" },
  { key: "streak", label: "연속 처치" },
  { key: "mobs", label: "잡몹" },
  { key: "date", label: "날짜" },
];

function shadowCardContent(d: ShadowShareData, show: Record<string, boolean>): PhotoCardContent {
  const stats: { value: string; label: string }[] = [];
  if (show.hp) stats.push({ value: d.hp.toLocaleString(), label: "그림자 체력" });
  if (show.overkill && d.overkillPct > 0) stats.push({ value: `+${d.overkillPct}%`, label: "오버킬" });
  if (show.streak && d.streakWeeks > 0) stats.push({ value: `${d.streakWeeks}주`, label: "연속 처치" });
  if (show.mobs && d.mobsKilled > 0) stats.push({ value: `${d.mobsKilled}`, label: "잡몹 처치" });
  return {
    kicker: show.date ? `${dotDate(d.weekStart)} – ${dotDate(d.weekEnd).slice(5)} · 그림자 던전` : "그림자 던전",
    quote: "지난 4주의 나를 넘었다",
    headline: { value: "DOWN", label: "주간 보스 그림자 처치" },
    stats: stats.slice(0, 3),
  };
}

type Props = { data: ShadowShareData; onClose: () => void };

export default function ShadowShareEditor({ data, onClose }: Props) {
  const build = useCallback((show: Record<string, boolean>) => shadowCardContent(data, show), [data]);
  return (
    <PhotoShareEditor
      layout="fullscreen"
      onClose={onClose}
      toggles={TOGGLES.map((t) =>
        (t.key === "overkill" && data.overkillPct <= 0) || (t.key === "streak" && data.streakWeeks <= 0) || (t.key === "mobs" && data.mobsKilled <= 0)
          ? { ...t, disabled: true }
          : t,
      )}
      initialShow={{ hp: true, overkill: data.overkillPct > 0, streak: data.streakWeeks > 0, mobs: false, date: true }}
      build={build}
      fileName={shareFileName("shadow", data.weekStart)}
      shareTitle="득근득근 그림자 처치"
    />
  );
}
