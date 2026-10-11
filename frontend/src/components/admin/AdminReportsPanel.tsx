import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminTableShell from "./AdminTableShell";
import { adminApi, type AdminReportItem } from "../../services/adminApi";
import { friendlyError } from "../../lib/httpError";
import { REPORT_REASON_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL, type ReportStatus } from "../../lib/reportLabels";

// 관리자 화면 "신고" 탭: 사용자가 보낸 신고를 확인하고 조치한다.
// 같은 대상에 쌓인 확인 전 신고는 하나를 처리하면 서버가 함께 닫는다.

type Filter = ReportStatus | "all";

const FILTERS: Array<[Filter, string]> = [
  ["OPEN", REPORT_STATUS_LABEL.OPEN],
  ["ACTIONED", REPORT_STATUS_LABEL.ACTIONED],
  ["DISMISSED", REPORT_STATUS_LABEL.DISMISSED],
  ["all", "전체"],
];

const PAGE_SIZE = 20;

const STATUS_CHIP: Record<ReportStatus, string> = {
  OPEN: "bg-plate-yellow text-black",
  ACTIONED: "bg-plate-red text-white",
  DISMISSED: "bg-steel-700 text-steel-200",
};

const formatTime = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** 대상으로 갈 수 있는 화면 주소. 댓글은 댓글 번호로 찾아갈 수 없어 없음 */
const targetLink = (item: AdminReportItem): string | null => {
  if (item.targetType === "BRAG_POST") return `/brag/${item.targetId}`;
  if (item.targetType === "PROTEIN") return `/proteins/${item.targetId}`;
  return null;
};

type Props = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export default function AdminReportsPanel({ onSuccess, onError }: Props) {
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AdminReportItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  // "삭제하고 조치"는 한 번 더 눌러야 실행된다
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi.getReports({ status: filter, page, size: PAGE_SIZE });
      setItems(res.content ?? []);
      setTotalPages(res.totalPages ?? 0);
    } catch (e) {
      setItems([]);
      setLoadError(friendlyError(e, "신고 목록을 불러오지 못했어요."));
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeFilter = (next: Filter) => {
    setFilter(next);
    setPage(0);
    setConfirmDeleteId(null);
  };

  const resolve = async (item: AdminReportItem, status: "ACTIONED" | "DISMISSED", deleteContent: boolean) => {
    if (busyId !== null) return;
    if (deleteContent && confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    setBusyId(item.id);
    try {
      const note = notes[item.id]?.trim();
      await adminApi.resolveReport(item.id, { status, deleteContent, note: note || undefined });
      onSuccess(deleteContent ? "내용을 지우고 조치했어요." : status === "ACTIONED" ? "조치함으로 표시했어요." : "문제없음으로 닫았어요.");
      setConfirmDeleteId(null);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
    } catch (e) {
      onError(friendlyError(e, "신고를 처리하지 못했어요."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminTableShell
      title="신고"
      description="사용자가 보낸 신고를 확인하고 조치해요. 같은 대상의 확인 전 신고는 함께 닫혀요."
      loading={loading}
      hasData={items.length > 0 || !!loadError}
      onRefresh={() => void load()}
      emptyMessage={filter === "OPEN" ? "확인할 신고가 없어요." : "해당하는 신고가 없어요."}
      actionSlot={
        <div className="flex flex-wrap gap-2" role="group" aria-label="신고 상태">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
              className={`dg-btn min-h-[34px] px-3 text-xs ${filter === value ? "bg-plate-yellow text-black" : "dg-btn-steel"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {loadError && (
        <p role="alert" className="mb-3 text-sm font-semibold text-red-300">
          {loadError}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const link = targetLink(item);
          const busy = busyId === item.id;
          return (
            <article key={item.id} className="dg-well space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`dg-chip ${STATUS_CHIP[item.status] ?? "bg-steel-700 text-steel-200"}`}>
                  {REPORT_STATUS_LABEL[item.status] ?? item.status}
                </span>
                <span className="dg-chip bg-steel-800 text-chalk">{REPORT_TARGET_LABEL[item.targetType] ?? "기타"}</span>
                <span className="font-bold text-red-200">{REPORT_REASON_LABEL[item.reason] ?? "기타"}</span>
                <span className="ml-auto text-steel-400">{formatTime(item.createdAt)}</span>
              </div>

              {item.snapshot ? (
                <p className="line-clamp-5 whitespace-pre-wrap break-words rounded border-2 border-black bg-steel-900 px-3 py-2 text-sm text-steel-100">
                  {item.snapshot}
                </p>
              ) : (
                <p className="text-sm text-steel-500">신고 당시 내용이 없어요.</p>
              )}

              {item.detail && (
                <p className="whitespace-pre-wrap break-words text-sm text-steel-200">
                  <span className="font-semibold text-steel-400">신고 내용 · </span>
                  {item.detail}
                </p>
              )}

              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-steel-400">신고한 사람</dt>
                <dd className="truncate text-steel-200">{item.reporterNickname || "알 수 없음"}</dd>
                <dt className="text-steel-400">신고된 사람</dt>
                <dd className="truncate text-steel-200">{item.targetUserNickname || "알 수 없음"}</dd>
                {item.handledAt && (
                  <>
                    <dt className="text-steel-400">처리한 때</dt>
                    <dd className="text-steel-200">{formatTime(item.handledAt)}</dd>
                  </>
                )}
                {item.adminNote && (
                  <>
                    <dt className="text-steel-400">운영 메모</dt>
                    <dd className="whitespace-pre-wrap break-words text-steel-200">{item.adminNote}</dd>
                  </>
                )}
              </dl>

              {link ? (
                <Link
                  to={link}
                  target="_blank"
                  rel="noopener"
                  className="inline-block text-xs font-semibold text-plate-yellow underline underline-offset-2"
                >
                  대상 보러 가기
                </Link>
              ) : item.targetType === "BRAG_COMMENT" ? (
                <p className="text-xs text-steel-500">댓글은 바로 찾아갈 수 없어 위 내용으로 확인해요.</p>
              ) : null}

              {item.status === "OPEN" && (
                <div className="space-y-2 border-t-2 border-black pt-3">
                  <label className="block text-xs font-semibold text-steel-300">
                    운영 메모 <span className="font-normal text-steel-500">(선택)</span>
                    <input
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      maxLength={500}
                      className="mt-1 w-full rounded-md border-2 border-black bg-steel-900 px-3 py-2 text-sm text-chalk focus:outline-none focus-visible:border-plate-yellow"
                      placeholder="처리 이유를 남겨 두면 나중에 보기 좋아요"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {item.targetType !== "USER" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolve(item, "ACTIONED", true)}
                        className="dg-btn dg-btn-primary min-h-[34px] px-3 text-xs"
                      >
                        {confirmDeleteId === item.id ? "한 번 더 누르면 삭제돼요" : "삭제하고 조치"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resolve(item, "ACTIONED", false)}
                      className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
                    >
                      조치함(삭제 안 함)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resolve(item, "DISMISSED", false)}
                      className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
                    >
                      문제없음
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="dg-btn dg-btn-steel px-3 py-1 text-xs"
          >
            이전
          </button>
          <span className="font-num text-sm text-steel-300">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages}
            className="dg-btn dg-btn-steel px-3 py-1 text-xs"
          >
            다음
          </button>
        </div>
      )}
    </AdminTableShell>
  );
}
