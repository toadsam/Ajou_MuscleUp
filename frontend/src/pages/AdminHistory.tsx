import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminTableShell from "../components/admin/AdminTableShell";
import AdminToast from "../components/admin/AdminToast";
import { useAdminToast } from "../components/admin/useAdminToast";
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

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function AdminHistory() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const { toast, showError, clearToast } = useAdminToast();

  useEffect(() => {
    logEvent("admin_history", "page_view");
    void fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/audit?limit=300`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: EventItem[] = await res.json();
      setItems(data);
    } catch (e: any) {
      showError(e?.message || "이력 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [item.action, item.resource, item.summary || "", item.userEmail || "", item.userNickname || ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <section className="relative min-h-screen bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-pink-200">Admin History</p>
            <h1 className="mt-1 text-3xl font-extrabold">활동 이력</h1>
            <p className="mt-1 text-sm text-gray-300">최근 관리자 활동 로그를 검색하고 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
              대시보드
            </Link>
          </div>
        </header>

        <AdminTableShell
          title="감사 로그"
          description="최대 300건"
          loading={loading}
          hasData={filtered.length > 0}
          emptyMessage="표시할 로그가 없습니다."
          onRefresh={fetchEvents}
          actionSlot={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사용자/액션/리소스 검색"
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-gray-400"
            />
          }
        >
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10 text-left text-gray-200">
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
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t border-white/10 align-top">
                    <td className="p-3 text-gray-300">{formatDate(item.createdAt)}</td>
                    <td className="p-3">
                      <p className="font-semibold text-white">{item.userNickname || "익명"}</p>
                      <p className="text-xs text-gray-400">{item.userEmail || "-"}</p>
                    </td>
                    <td className="p-3 break-words text-gray-200">{item.resource}</td>
                    <td className="p-3 font-semibold text-pink-200">{item.action}</td>
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
