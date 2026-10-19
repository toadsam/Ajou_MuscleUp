import { Link } from "react-router-dom";
import { DUNGEON_PATH, shadowOneLiner, type ShadowStatus } from "../../lib/shadow";

// 홈 화이트보드 카드 안의 한 줄 — "그림자 ████░░ 228 남음 · 모은 힘 120 → 던전". 새 카드를 늘리지 않는다(설계 5.1).
// 모은 힘이 있으면 던전으로, 없으면 전적(/shadow)으로. 보드 위라 마커 색(board-red) · 보드 잉크로 그린다.

export default function ShadowHomeRow({ status }: { status: ShadowStatus | null }) {
  if (!status) return null;
  const pct = status.rest ? 0 : Math.max(0, Math.min(100, (status.remaining / Math.max(1, status.hp)) * 100));
  const charged = (status.chargeTotal ?? 0) > 0;
  const line = shadowOneLiner(status);
  return (
    <Link
      to={charged ? DUNGEON_PATH : "/shadow"}
      className="mx-[1.2rem] mb-2 flex items-center gap-3 border-t border-dashed border-board-frame pt-2 text-board-ink"
      aria-label={`주간 보스 그림자 — ${line}${charged ? `, 모은 힘 ${status.chargeTotal}, 던전으로` : ""}`}
    >
      <span className="text-xs text-[#59607a]">그림자</span>
      <span className="relative h-3 flex-1 overflow-hidden rounded-sm border border-board-ink/60 bg-white/60" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 ${status.killed ? "bg-board-ink/30" : "bg-board-red"}`}
          style={{ width: `${status.killed ? 100 : pct}%` }}
        />
      </span>
      <strong className="font-pen text-xl leading-none">{charged ? `힘 ${status.chargeTotal} 모음` : line}</strong>
      {!charged && status.streakWeeks > 0 && <small className="text-xs text-[#59607a]">{status.streakWeeks}주 연속</small>}
      <span className={`text-xs ${charged ? "font-bold text-board-red" : "text-[#59607a]"}`} aria-hidden="true">
        {charged ? "던전 →" : "→"}
      </span>
    </Link>
  );
}
