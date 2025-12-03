import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type ProteinItem = { id: number; name: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function Admin() {
  const [status, setStatus] = useState<string>("체크 중...");
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [pages, setPages] = useState<PageCount[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [proteins, setProteins] = useState<ProteinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [loadingProteins, setLoadingProteins] = useState(false);

  const maxAction = useMemo(() => actions.reduce((m, a) => Math.max(m, a.count || 0), 0) || 1, [actions]);
  const maxPage = useMemo(() => pages.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1, [pages]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const pingRes = await fetch(`${API_BASE}/api/admin/ping`, { credentials: "include" });
        setStatus(pingRes.ok ? "OK" : `에러 ${pingRes.status}`);

        const res = await fetch(`${API_BASE}/api/admin/analytics/summary?days=30`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const data: SummaryResponse = await res.json();
        setActions(data.actionCounts ?? []);
        setPages(data.pageCounts ?? []);
      } catch (e: any) {
        setError(e?.message || "요약을 불러오지 못했어요.");
      }
    };
    fetchSummary();
    logEvent("admin_dashboard", "page_view");
  }, []);

  const loadApplications = async () => {
    try {
      setLoadingApps(true);
      const res = await fetch(`${API_BASE}/api/admin/programs/applications`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: Application[] = await res.json();
      setApplications(data);
    } catch (e: any) {
      setError(e?.message || "신청 목록을 불러오지 못했어요.");
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const updateStatus = async (id: number, status: Application["status"]) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/programs/applications/${id}/status?status=${status}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadApplications();
    } catch (e: any) {
      alert(e?.message || "상태 변경에 실패했습니다.");
    }
  };

  const loadGallery = async () => {
    try {
      setLoadingGallery(true);
      const res = await fetch(`${API_BASE}/api/files/list?folder=gallery`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: string[] = await res.json();
      setGallery(data);
    } catch (e: any) {
      setError(e?.message || "갤러리를 불러오지 못했어요.");
    } finally {
      setLoadingGallery(false);
    }
  };

  const deleteGalleryItem = async (url: string) => {
    if (!confirm("이 파일을 삭제할까요?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(url)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadGallery();
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.");
    }
  };

  const loadProteins = async () => {
    try {
      setLoadingProteins(true);
      const res = await fetch(`${API_BASE}/api/proteins?size=100`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.content ?? [];
      setProteins(list.map((p: any) => ({ id: p.id, name: p.name })));
    } catch (e: any) {
      setError(e?.message || "단백질 목록을 불러오지 못했어요.");
    } finally {
      setLoadingProteins(false);
    }
  };

  const deleteProtein = async (id: number) => {
    if (!confirm("이 단백질 상품을 삭제할까요?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/proteins/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadProteins();
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.");
    }
  };

  const [brags, setBrags] = useState<{ id: number; title: string }[]>([]);
  const [loadingBrags, setLoadingBrags] = useState(false);

  const loadBrags = async () => {
    try {
      setLoadingBrags(true);
      const res = await fetch(`${API_BASE}/api/brags?page=0&size=100`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.content ?? [];
      setBrags(list.map((b: any) => ({ id: b.id, title: b.title })));
    } catch (e: any) {
      setError(e?.message || "자랑 목록을 불러오지 못했어요.");
    } finally {
      setLoadingBrags(false);
    }
  };

  const deleteBrag = async (id: number) => {
    if (!confirm("이 자랑글을 삭제할까요?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/brags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadBrags();
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.");
    }
  };

  useEffect(() => {
    loadGallery();
    loadProteins();
    loadBrags();
  }, []);

  const forceDelete = async (type: "brag" | "comment" | "review" | "ai", id: string) => {
    if (!id) {
      alert("ID를 입력하세요");
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
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      alert("삭제되었습니다.");
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.");
    }
  };

  const statuses: Application["status"][] = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"];

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <style>{`
        @keyframes aurora {
          0% { transform: translateX(-10%) translateY(0); opacity: 0.6; }
          50% { transform: translateX(10%) translateY(-5%); opacity: 0.9; }
          100% { transform: translateX(-10%) translateY(0); opacity: 0.6; }
        }
        .aurora {
          background: radial-gradient(circle at 20% 20%, rgba(236,72,153,0.25), transparent 35%),
                      radial-gradient(circle at 80% 0%, rgba(56,189,248,0.25), transparent 35%),
                      radial-gradient(circle at 50% 50%, rgba(94,92,246,0.2), transparent 40%);
          animation: aurora 12s ease-in-out infinite;
        }
      `}</style>
      <div className="absolute inset-0 aurora blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-28 lg:px-10 space-y-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-r from-white/15 via-white/5 to-white/15 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-pink-500/30 px-3 py-1 text-xs font-semibold text-pink-50">Admin</span>
            <p className="text-sm uppercase tracking-[0.25em] text-gray-200">Control Center</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">운영 현황</h1>
              <p className="text-gray-200">
                백엔드 상태: <span className="text-emerald-300 font-semibold">{status}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/history"
                className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                내역보기
              </Link>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-200 shadow-inner">
                <p className="text-xs text-gray-400">오늘</p>
                <p className="text-lg font-semibold">{new Date().toLocaleString("ko-KR", { month: "short", day: "numeric" })}</p>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="액션 이벤트" value={actions.length} desc="최근 30일 이벤트 종류" accent="from-pink-500 to-orange-400" />
          <StatCard title="페이지 뷰" value={pages.length} desc="최근 30일 페이지 종류" accent="from-emerald-400 to-cyan-400" />
          <StatCard title="프로그램 신청" value={applications.length} desc="총 신청 수" accent="from-blue-500 to-indigo-500" />
          <StatCard title="관리자 권한" value="OK" desc="ROLE_ADMIN" accent="from-purple-500 to-pink-400" />
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

        <div className="grid gap-6 lg:grid-cols-3">
          <GalleryPanel items={gallery} loading={loadingGallery} onRefresh={loadGallery} onDelete={deleteGalleryItem} />
          <ProteinPanel items={proteins} loading={loadingProteins} onRefresh={loadProteins} onDelete={deleteProtein} />
          <BragPanel items={brags} loading={loadingBrags} onRefresh={loadBrags} onDelete={deleteBrag} />
        </div>
      </div>
    </section>
  );
}

function StatCard({ title, value, desc, accent }: { title: string; value: number | string; desc: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-20 animate-pulse`} />
      <div className="relative">
        <p className="text-sm text-gray-300">{title}</p>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, items, max, color }: { title: string; subtitle: string; items: ActionCount[]; max: number; color: string }) {
  return (
    <div className="rounded-2xl bg-gray-800/70 border border-white/10 p-6 shadow-lg backdrop-blur overflow-hidden">
      <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">데이터가 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((a, idx) => (
            <li key={a.action} className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-white">{a.action}</span>
                <span className="text-pink-200">{a.count}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                  style={{ width: `${Math.max(6, (a.count / max) * 100)}%`, animationDelay: `${idx * 80}ms` }}
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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">프로그램 신청</h3>
          <p className="text-sm text-gray-300">신청자 목록 및 상태 변경</p>
        </div>
        <button onClick={onRefresh} className="text-sm text-pink-200 hover:text-pink-100">
          새로고침
        </button>
      </div>
      {loading && <p className="text-sm text-gray-300">불러오는 중...</p>}
      {!loading && applications.length === 0 && <p className="text-sm text-gray-400">신청이 없습니다.</p>}
      {!loading && applications.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {applications.map((app) => (
            <div key={app.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner hover:border-pink-300/30 transition">
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

function GalleryPanel({
  items,
  loading,
  onRefresh,
  onDelete,
}: {
  items: string[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (url: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">갤러리 관리</h3>
          <p className="text-sm text-gray-300">업로드된 파일 삭제</p>
        </div>
        <button onClick={onRefresh} className="text-sm text-pink-200 hover:text-pink-100" disabled={loading}>
          새로고침
        </button>
      </div>
      {loading && <p className="text-sm text-gray-300">불러오는 중...</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-400">표시할 파일이 없습니다.</p>}
      <div className="grid grid-cols-2 gap-3">
        {items.map((url) => (
          <div key={url} className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
            <img src={url} alt="" className="w-full h-32 object-cover" />
            <button
              onClick={() => onDelete(url)}
              className="absolute top-2 right-2 rounded-full bg-red-500/80 px-3 py-1 text-xs text-white hover:opacity-90"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProteinPanel({
  items,
  loading,
  onRefresh,
  onDelete,
}: {
  items: ProteinItem[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">단백질 관리</h3>
          <p className="text-sm text-gray-300">등록된 상품 삭제</p>
        </div>
        <button onClick={onRefresh} className="text-sm text-pink-200 hover:text-pink-100" disabled={loading}>
          새로고침
        </button>
      </div>
      {loading && <p className="text-sm text-gray-300">불러오는 중...</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-400">표시할 상품이 없습니다.</p>}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <span className="text-sm text-white">{p.name}</span>
            <button
              onClick={() => onDelete(p.id)}
              className="rounded-full bg-red-500/80 px-3 py-1 text-xs text-white hover:opacity-90"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BragPanel({
  items,
  loading,
  onRefresh,
  onDelete,
}: {
  items: { id: number; title: string }[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">자랑방 관리</h3>
          <p className="text-sm text-gray-300">게시글 삭제</p>
        </div>
        <button onClick={onRefresh} className="text-sm text-pink-200 hover:text-pink-100" disabled={loading}>
          새로고침
        </button>
      </div>
      {loading && <p className="text-sm text-gray-300">불러오는 중...</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-400">표시할 게시글이 없습니다.</p>}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {items.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="text-sm text-white truncate pr-2">{b.title || `자랑 #${b.id}`}</div>
            <button
              onClick={() => onDelete(b.id)}
              className="rounded-full bg-red-500/80 px-3 py-1 text-xs text-white hover:opacity-90"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
