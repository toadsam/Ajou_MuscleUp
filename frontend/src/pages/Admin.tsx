import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminToast from "../components/admin/AdminToast";
import {
  ApplicationPanel,
  AttendanceSharePanel,
  MediaPanel,
  StatCard,
  TopListCard,
  toChangingSet,
  type ActionCount,
  type Application,
  type AttendanceShareItem,
  type BragItem,
  type ProteinItem,
} from "../components/admin/AdminDashboardPanels";
import { useAdminToast } from "../components/admin/useAdminToast";
import { logEvent } from "../utils/analytics";

type PageCount = { page: string; count: number };
type SummaryResponse = {
  actionCounts: ActionCount[];
  pageCounts: PageCount[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function Admin() {
  const [status, setStatus] = useState<string>("점검 중...");
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [pages, setPages] = useState<PageCount[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [proteins, setProteins] = useState<ProteinItem[]>([]);
  const [brags, setBrags] = useState<BragItem[]>([]);
  const [attendanceShares, setAttendanceShares] = useState<AttendanceShareItem[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [loadingProteins, setLoadingProteins] = useState(false);
  const [loadingBrags, setLoadingBrags] = useState(false);
  const [loadingAttendanceShares, setLoadingAttendanceShares] = useState(false);

  const [changingStatusIds, setChangingStatusIds] = useState<Set<number>>(new Set());
  const [processingAttendanceId, setProcessingAttendanceId] = useState<number | null>(null);

  const { toast, showError, showSuccess, clearToast } = useAdminToast();

  const maxAction = useMemo(() => actions.reduce((m, a) => Math.max(m, a.count || 0), 0) || 1, [actions]);
  const maxPage = useMemo(() => pages.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1, [pages]);

  useEffect(() => {
    void fetchSummary();
    void loadApplications();
    void loadGallery();
    void loadProteins();
    void loadBrags();
    void loadAttendanceShares();
    logEvent("admin_dashboard", "page_view");
  }, []);

  const fetchSummary = async () => {
    try {
      setError(null);
      const pingRes = await fetch(`${API_BASE}/api/admin/ping`, { credentials: "include" });
      setStatus(pingRes.ok ? "정상" : `오류 ${pingRes.status}`);

      const res = await fetch(`${API_BASE}/api/admin/analytics/summary?days=30`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: SummaryResponse = await res.json();
      setActions(data.actionCounts ?? []);
      setPages(data.pageCounts ?? []);
    } catch (e: any) {
      const message = e?.message || "요약 데이터를 불러오지 못했습니다.";
      setError(message);
      showError(message);
    }
  };

  const loadApplications = async () => {
    try {
      setLoadingApps(true);
      const res = await fetch(`${API_BASE}/api/admin/programs/applications`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: Application[] = await res.json();
      setApplications(data);
    } catch (e: any) {
      showError(e?.message || "신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingApps(false);
    }
  };

  const updateStatus = async (id: number, nextStatus: Application["status"]) => {
    try {
      toChangingSet(setChangingStatusIds, id, true);
      const res = await fetch(`${API_BASE}/api/admin/programs/applications/${id}/status?status=${nextStatus}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadApplications();
      showSuccess("신청 상태를 변경했습니다.");
    } catch (e: any) {
      showError(e?.message || "상태 변경에 실패했습니다.");
    } finally {
      toChangingSet(setChangingStatusIds, id, false);
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
      showError(e?.message || "갤러리 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingGallery(false);
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
      showError(e?.message || "단백질 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingProteins(false);
    }
  };

  const loadBrags = async () => {
    try {
      setLoadingBrags(true);
      const res = await fetch(`${API_BASE}/api/brags?page=0&size=100`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.content ?? [];
      setBrags(list.map((b: any) => ({ id: b.id, title: b.title })));
    } catch (e: any) {
      showError(e?.message || "자랑방 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingBrags(false);
    }
  };

  const loadAttendanceShares = async () => {
    try {
      setLoadingAttendanceShares(true);
      const res = await fetch(`${API_BASE}/api/admin/attendance/shares?limit=100`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data: AttendanceShareItem[] = await res.json();
      setAttendanceShares(data);
    } catch (e: any) {
      showError(e?.message || "출석 공유 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingAttendanceShares(false);
    }
  };

  const deleteGalleryItem = async (url: string) => {
    const confirmed = await confirmDangerousAction("갤러리 파일 삭제");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(url)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadGallery();
      showSuccess("갤러리 파일을 삭제했습니다.");
    } catch (e: any) {
      showError(e?.message || "삭제에 실패했습니다.");
    }
  };

  const deleteProtein = async (id: number) => {
    const confirmed = await confirmDangerousAction("단백질 상품 삭제");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/proteins/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadProteins();
      showSuccess("상품을 삭제했습니다.");
    } catch (e: any) {
      showError(e?.message || "삭제에 실패했습니다.");
    }
  };

  const deleteBrag = async (id: number) => {
    const confirmed = await confirmDangerousAction("자랑방 게시글 삭제");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/brags/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadBrags();
      showSuccess("게시글을 삭제했습니다.");
    } catch (e: any) {
      showError(e?.message || "삭제에 실패했습니다.");
    }
  };

  const setAttendanceHidden = async (id: number, hidden: boolean) => {
    const ok = hidden
      ? await confirmDangerousAction("출석 공유 비공개")
      : window.confirm("해당 출석 공유를 다시 공개할까요?");
    if (!ok) return;

    try {
      setProcessingAttendanceId(id);
      const res = await fetch(`${API_BASE}/api/admin/attendance/shares/${id}/hidden?hidden=${hidden}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await loadAttendanceShares();
      showSuccess(hidden ? "비공개 처리했습니다." : "공개 처리했습니다.");
    } catch (e: any) {
      showError(e?.message || "처리에 실패했습니다.");
    } finally {
      setProcessingAttendanceId(null);
    }
  };

  const statuses: Application["status"][] = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"];

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-8 px-6 pb-24 pt-28 lg:px-10">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/15 via-white/5 to-white/15 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Admin Control Center</p>
              <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">관리자 대시보드</h1>
              <p className="mt-1 text-sm text-gray-200">
                백엔드 상태: <span className="font-semibold text-emerald-300">{status}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/admin/events" className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90">
                이벤트 관리
              </Link>
              <Link to="/admin/history" className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold hover:opacity-90">
                이력 보기
              </Link>
              <button
                type="button"
                onClick={() => void fetchSummary()}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-gray-100 hover:bg-white/10"
              >
                요약 새로고침
              </button>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="액션 이벤트" value={actions.length} desc="최근 30일 이벤트 종류" accent="from-pink-500 to-orange-400" />
          <StatCard title="페이지 이벤트" value={pages.length} desc="최근 30일 페이지 종류" accent="from-emerald-400 to-cyan-400" />
          <StatCard title="프로그램 신청" value={applications.length} desc="현재 전체 신청 수" accent="from-blue-500 to-indigo-500" />
          <StatCard title="권한" value="ROLE_ADMIN" desc="관리자 인증 완료" accent="from-purple-500 to-pink-400" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TopListCard title="액션 TOP" subtitle="/api/admin/analytics/summary" items={actions} max={maxAction} color="from-pink-500 to-orange-400" />
          <TopListCard
            title="페이지 TOP"
            subtitle="최근 30일"
            items={pages.map((page) => ({ action: page.page, count: page.count }))}
            max={maxPage}
            color="from-emerald-400 to-cyan-400"
          />
        </div>

        <ApplicationPanel
          applications={applications}
          loading={loadingApps}
          onRefresh={loadApplications}
          onChangeStatus={updateStatus}
          statuses={statuses}
          changingStatusIds={changingStatusIds}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <MediaPanel
            title="갤러리 관리"
            description="업로드 파일 확인 및 삭제"
            loading={loadingGallery}
            hasData={gallery.length > 0}
            onRefresh={loadGallery}
            emptyMessage="갤러리 파일이 없습니다."
          >
            <div className="grid grid-cols-2 gap-3">
              {gallery.map((url) => (
                <div key={url} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  <img src={url} alt="gallery" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => void deleteGalleryItem(url)}
                    className="absolute right-2 top-2 rounded-full bg-red-500/85 px-3 py-1 text-xs text-white hover:opacity-90"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </MediaPanel>

          <MediaPanel
            title="단백질 상품 관리"
            description="등록 상품 목록 및 삭제"
            loading={loadingProteins}
            hasData={proteins.length > 0}
            onRefresh={loadProteins}
            emptyMessage="표시할 상품이 없습니다."
          >
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {proteins.map((protein) => (
                <div key={protein.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-sm text-white">{protein.name}</span>
                  <button
                    type="button"
                    onClick={() => void deleteProtein(protein.id)}
                    className="rounded-full bg-red-500/85 px-3 py-1 text-xs text-white hover:opacity-90"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </MediaPanel>

          <MediaPanel
            title="자랑방 관리"
            description="게시글 목록 및 삭제"
            loading={loadingBrags}
            hasData={brags.length > 0}
            onRefresh={loadBrags}
            emptyMessage="표시할 게시글이 없습니다."
          >
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {brags.map((brag) => (
                <div key={brag.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="truncate pr-2 text-sm text-white">{brag.title || `자랑글 #${brag.id}`}</span>
                  <button
                    type="button"
                    onClick={() => void deleteBrag(brag.id)}
                    className="rounded-full bg-red-500/85 px-3 py-1 text-xs text-white hover:opacity-90"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </MediaPanel>
        </div>

        <AttendanceSharePanel
          items={attendanceShares}
          loading={loadingAttendanceShares}
          onRefresh={loadAttendanceShares}
          onHide={(id) => void setAttendanceHidden(id, true)}
          onShow={(id) => void setAttendanceHidden(id, false)}
          processingId={processingAttendanceId}
        />
      </div>

      <AdminToast toast={toast} onClose={clearToast} />
    </section>
  );
}

async function confirmDangerousAction(actionName: string) {
  const firstConfirm = window.confirm(`${actionName}을(를) 진행할까요?`);
  if (!firstConfirm) return false;

  const secondConfirm = window.prompt("계속하려면 DELETE 를 입력하세요.");
  return secondConfirm === "DELETE";
}
