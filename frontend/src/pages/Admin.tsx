import { useEffect, useMemo, useState } from "react";
import { logEvent } from "../utils/analytics";

type ActionCount = { action: string; count: number };
type PageCount = { page: string; count: number };
type Application = {
  id: number;
  name: string;
  email: string;
  goal: string;
  track: string;
  commitment: string;
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type SummaryResponse = {
  actionCounts: ActionCount[];
  pageCounts: PageCount[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function Admin() {
  const [status, setStatus] = useState<string>("체크 중...");
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [pages, setPages] = useState<PageCount[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);

  const token = localStorage.getItem("token");
  const maxAction = useMemo(() => actions.reduce((m, a) => Math.max(m, a.count || 0), 0) || 1, [actions]);
  const maxPage = useMemo(() => pages.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1, [pages]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const pingRes = await fetch(`${API_BASE}/api/admin/ping`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        setStatus(pingRes.ok ? "OK" : `에러 ${pingRes.status}`);

        const res = await fetch(`${API_BASE}/api/admin/analytics/summary?days=30`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const data: SummaryResponse = await res.json();
        setActions(data.actionCounts ?? []);
        setPages(data.pageCounts ?? []);
      } catch (e: any) {
        setError(e?.message || "요약을 불러오지 못했습니다.");
      }
    };
    fetchSummary();
    logEvent("admin_dashboard", "page_view");
  }, [token]);

  const loadApplications = async () => {
    if (!token) return;
    try {
      setLoadingApps(true);
      const res = await fetch(`${API_BASE}/api/admin/programs/applications`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: Application[] = await res.json();
      setApplications(data);
    } catch (e: any) {
      setError(e?.message || "신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const updateStatus = async (id: number, status: Application["status"]) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/programs/applications/${id}/status?status=${status}`, {
        method: "PATCH",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadApplications();
    } catch (e: any) {
      alert(e?.message || "상태 변경에 실패했습니다.");
    }
  };

  const forceDelete = async (type: "brag" | "comment" | "review" | "ai", id: string) => {
    if (!id) {
      alert("ID를 입력하세요.");
      return;
    }
    const map: Record<string, string> = {
      brag: `/api/admin/brags/${id}`,
      comment: `/api/admin/brags/comments/${id}`,
      review: `/api/admin/reviews/${id}`,
      ai: `/api/admin/ai/history/${id}`,
    };
    try {
      const res = await fetch(`${API_BASE}${map[type]}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      alert("삭제되었습니다.");
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.");
    }
  };

  const statuses: Application["status"][] = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"];

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-24 top-0 h-80 w-80 rounded-full bg-pink-500/20" />
      <div className="glow-orb absolute right-0 top-10 h-96 w-96 rounded-full bg-indigo-500/20" />
      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-200">Admin Dashboard</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">운영 현황</h1>
          <p className="text-gray-300">백엔드 상태: {status}</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="액션 이벤트" value={actions.length} desc="최근 30일 액션 종류" />
          <StatCard title="페이지 트래픽" value={pages.length} desc="최근 30일 페이지 종류" />
          <StatCard title="프로그램 신청" value={applications.length} desc="누적 신청서" />
          <StatCard title="관리자 권한" value="OK" desc="ROLE_ADMIN" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="액션 TOP" subtitle="/api/admin/analytics/summary" items={actions} max={maxAction} color="from-pink-500 to-orange-400" />
          <ChartCard title="페이지 TOP" subtitle="최근 30일" items={pages.map((p) => ({ action: p.page, count: p.count }))} max={maxPage} color="from-emerald-400 to-cyan-400" />
        </div>

        <ApplicationTable
          applications={applications}
          loading={loadingApps}
          onRefresh={loadApplications}
          onChangeStatus={updateStatus}
          statuses={statuses}
        />

        <ForceDeletePanel onDelete={forceDelete} />
      </div>
    </section>
  );
}

function StatCard({ title, value, desc }: { title: string; value: number | string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <p className="text-sm text-gray-300">{title}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, items, max, color }: { title: string; subtitle: string; items: ActionCount[]; max: number; color: string }) {
  return (
    <div className="rounded-2xl bg-gray-800/70 border border-white/10 p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">데이터가 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((a) => (
            <li key={a.action} className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-white">{a.action}</span>
                <span className="text-pink-200">{a.count}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${color}`}
                  style={{ width: `${Math.max(6, (a.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationTable({
  applications,
  loading,
  onRefresh,
  onChangeStatus,
  statuses,
}: {
  applications: Application[];
  loading: boolean;
  onRefresh: () => void;
  onChangeStatus: (id: number, status: Application["status"]) => void;
  statuses: Application["status"][];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">프로그램 신청</h3>
          <p className="text-sm text-gray-300">신청서 목록 및 상태 변경</p>
        </div>
        <button onClick={onRefresh} className="text-sm text-pink-200 hover:text-pink-100">
          새로고침
        </button>
      </div>
      {loading && <p className="text-sm text-gray-300 mt-3">불러오는 중...</p>}
      {!loading && applications.length === 0 && <p className="text-sm text-gray-400 mt-3">신청이 없습니다.</p>}
      {!loading && applications.length > 0 && (
        <div className="mt-4 space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">{app.name}</p>
                  <p className="text-xs text-gray-300">{app.email}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs border border-white/10">{app.track}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs border border-white/10">{new Date(app.createdAt).toLocaleString()}</span>
                <select
                  value={app.status}
                  onChange={(e) => onChangeStatus(app.id, e.target.value as Application["status"])}
                  className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s} className="bg-gray-900">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-3 text-sm text-gray-200">목표: {app.goal}</p>
              <p className="text-sm text-gray-400">참여 의지: {app.commitment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ForceDeletePanel({ onDelete }: { onDelete: (type: "brag" | "comment" | "review" | "ai", id: string) => void }) {
  const [ids, setIds] = useState({ brag: "", comment: "", review: "", ai: "" });
  const inputClass = "flex-1 rounded-lg bg-black/40 border border-gray-700 px-3 py-2 text-white";
  const btnClass = "px-3 py-2 rounded-lg bg-red-500/80 text-white text-sm hover:opacity-90";
  return (
    <div className="rounded-2xl bg-gray-800/70 border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">관리자 강제 삭제</h3>
        <span className="text-xs text-red-300">주의: 복구 불가</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-200">
          자랑글 ID
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={ids.brag}
              onChange={(e) => setIds((p) => ({ ...p, brag: e.target.value }))}
              placeholder="예: 12"
            />
            <button className={btnClass} onClick={() => onDelete("brag", ids.brag)}>
              삭제
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-200">
          자랑 댓글 ID
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={ids.comment}
              onChange={(e) => setIds((p) => ({ ...p, comment: e.target.value }))}
              placeholder="예: 34"
            />
            <button className={btnClass} onClick={() => onDelete("comment", ids.comment)}>
              삭제
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-200">
          후기 ID
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={ids.review}
              onChange={(e) => setIds((p) => ({ ...p, review: e.target.value }))}
              placeholder="예: 7"
            />
            <button className={btnClass} onClick={() => onDelete("review", ids.review)}>
              삭제
            </button>
          </div>
        </label>
        <label className="text-sm text-gray-200">
          AI 히스토리 ID
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={ids.ai}
              onChange={(e) => setIds((p) => ({ ...p, ai: e.target.value }))}
              placeholder="예: 3"
            />
            <button className={btnClass} onClick={() => onDelete("ai", ids.ai)}>
              삭제
            </button>
          </div>
        </label>
      </div>
    </div>
  );
}
