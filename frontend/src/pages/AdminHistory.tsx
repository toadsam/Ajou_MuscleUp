import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminTableShell from "../components/admin/AdminTableShell";
import AdminToast from "../components/admin/AdminToast";
import { useAdminToast } from "../components/admin/useAdminToast";
import { adminApi, adminQueryKeys } from "../services/adminApi";
import { logEvent } from "../utils/analytics";

type EventItem = {
  id: number;
  action: string;
  resource: string;
  summary?: string | null;
  metadata?: string | null;
  userEmail?: string | null;
  userNickname?: string | null;
  createdAt: string;
};

export default function AdminHistory() {
  const [query, setQuery] = useState("");
  const { toast, showError, clearToast } = useAdminToast();

  const auditQuery = useQuery<EventItem[]>({
    queryKey: adminQueryKeys.audit(300),
    queryFn: () => adminApi.getAudit(300),
  });

  useEffect(() => {
    logEvent("admin_history", "page_view");
  }, []);

  useEffect(() => {
    if (auditQuery.isError) showError("이력 데이터를 불러오지 못했습니다.");
  }, [auditQuery.isError, showError]);

  const items = auditQuery.data ?? [];
  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [item.action, item.resource, item.summary || "", item.userEmail || "", item.userNickname || ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <section className="relative min-h-screen px-6 pb-20 pt-28 text-chalk lg:px-10">

      <div className="relative mx-auto max-w-7xl space-y-8">
        <header className="dg-steel dg-rise relative flex flex-wrap items-end justify-between gap-3 overflow-hidden p-5">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 border-b-2 border-black bg-plate-red" />
          <div>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-plate-yellow">
              관리자 기록 <span className="font-num text-xs tracking-wide text-steel-500">HISTORY</span>
            </p>
            <h1 className="mt-1 text-3xl">활동 이력</h1>
            <p className="mt-1 text-sm text-steel-300">최근 관리자 활동 로그를 검색하고 확인합니다.</p>
          </div>
          <Link to="/admin" className="dg-btn dg-btn-steel px-4 py-2 text-sm">대시보드</Link>
        </header>

        <AdminTableShell
          title="감사 로그"
          description="최대 300건"
          loading={auditQuery.isLoading}
          hasData={filtered.length > 0}
          emptyMessage="표시할 로그가 없습니다."
          onRefresh={() => void auditQuery.refetch()}
          actionSlot={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사용자/액션/리소스 검색"
              aria-label="감사 로그 검색"
              className="rounded-md border-2 border-black bg-steel-900 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow px-3 py-1.5 text-sm"
            />
          }
        >
          <div className="overflow-x-auto rounded-md border-2 border-black bg-steel-900">
            <table className="min-w-full text-sm">
              <thead className="border-b-2 border-black bg-steel-950 text-left text-steel-300">
                <tr>
                  <th className="p-3">시간</th>
                  <th className="p-3">사용자</th>
                  <th className="p-3">리소스</th>
                  <th className="p-3">액션</th>
                  <th className="p-3">요약</th>
                  <th className="p-3">메타데이터</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="dg-rise border-t border-steel-800 align-top transition-colors hover:bg-steel-800"
                    style={{ animationDelay: `${Math.min(idx, 15) * 40}ms` }}
                  >
                    <td className="whitespace-nowrap p-3 font-num text-sm tracking-wide text-steel-300">{formatDate(item.createdAt)}</td>
                    <td className="p-3">
                      <p className="font-semibold text-white">{item.userNickname || "익명"}</p>
                      <p className="text-xs text-gray-400">{item.userEmail || "-"}</p>
                    </td>
                    <td className="p-3 break-words text-gray-200">{item.resource}</td>
                    <td className="p-3 font-semibold text-red-300">{item.action}</td>
                    <td className="p-3 text-xs text-gray-300">{item.summary || "-"}</td>
                    <td className="p-3 text-xs text-gray-300">{item.metadata || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      </div>

      <AdminToast toast={toast} onClose={clearToast} />
    </section>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}



