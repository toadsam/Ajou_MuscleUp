import { Link } from "react-router-dom";
import { shadowOneLiner, type ShadowStatus } from "../../lib/shadow";

// 홈 화이트보드 카드 안의 한 줄 — "그림자 ████░░ 228 남음". 새 카드를 늘리지 않는다(설계 5.3). 누르면 /shadow.
// 보드 위라 마커 색(board-red) · 보드 잉크로 그린다.

export default function ShadowHomeRow({ status }: { status: ShadowStatus | null }) {
  if (!status) return null;
  const pct = status.rest ? 0 : Math.max(0, Math.min(100, (status.remaining / Math.max(1, status.hp)) * 100));
  return (
    <Link
      to="/shadow"
      className="mx-[1.2rem] mb-2 flex items-center gap-3 border-t border-dashed border-board-frame pt-2 text-board-ink"
      aria-label={`주간 보스 그림자 — ${shadowOneLiner(status)}`}
    >
      <span className="text-xs text-[#59607a]">그림자</span>
      <span className="relative h-3 flex-1 overflow-hidden rounded-sm border border-board-ink/60 bg-white/60" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 ${status.killed ? "bg-board-ink/30" : "bg-board-red"}`}
          style={{ width: `${status.killed ? 100 : pct}%` }}
        />
      </span>
      <strong className="font-pen text-xl leading-none">{shadowOneLiner(status)}</strong>
      {status.streakWeeks > 0 && <small className="text-xs text-[#59607a]">{status.streakWeeks}주 연속</small>}
      <span className="text-[#59607a]" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
