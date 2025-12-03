import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logEvent("admin_history", "page_view");
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/audit?limit=300`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: EventItem[] = await res.json();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="relative min-h-screen bg-slate-950 text-white px-6 pb-20 pt-28 lg:px-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-pink-200">Admin</p>
            <h1 className="text-3xl font-extrabold">활동 내역</h1>
            <p className="text-sm text-gray-300 mt-1">누가 무엇을 생성/수정/삭제/요청했는지 최근 이벤트를 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin"
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              ← 대시보드
            </Link>
            <button
              onClick={fetchEvents}
              className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold hover:opacity-90"
              disabled={loading}
            >
              새로고침
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading && <p className="text-sm text-gray-300">불러오는 중...</p>}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="grid grid-cols-7 gap-3 px-4 py-3 text-xs font-semibold text-gray-300">
            <div>시간</div>
            <div>사용자</div>
            <div>리소스</div>
            <div>액션</div>
            <div>요약</div>
            <div className="col-span-2">메타데이터</div>
          </div>
          <div className="divide-y divide-white/5">
            {items.map((e) => (
              <div key={e.id} className="grid grid-cols-7 gap-3 px-4 py-3 text-sm text-gray-100">
                <div className="text-gray-300">{formatDate(e.createdAt)}</div>
                <div>
                  <div className="font-semibold">{e.userNickname || "익명"}</div>
                  <div className="text-xs text-gray-400">{e.userEmail || "-"}</div>
                </div>
                <div className="break-words text-gray-200">{e.resource}</div>
                <div className="font-semibold text-pink-200">{e.action}</div>
                <div className="text-xs text-gray-300 whitespace-pre-wrap break-words">{e.summary || "-"}</div>
                <div className="col-span-2 text-xs text-gray-300 whitespace-pre-wrap break-words">{e.metadata || "-"}</div>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">표시할 내역이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
