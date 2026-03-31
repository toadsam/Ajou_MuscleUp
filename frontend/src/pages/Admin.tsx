import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import AdminToast from "../components/admin/AdminToast";
import { MediaPanel, StatCard, TopListCard, toChangingSet, type ActionCount, type Application, type AttendanceShareItem, type BragItem, type ProteinItem } from "../components/admin/AdminDashboardPanels";
import { useAdminToast } from "../components/admin/useAdminToast";
import { adminApi } from "../services/adminApi";
import type { AdminAttendanceLogItem, AnalyticsEventItem, AuditLogItem, SupportInquiryItem } from "../services/adminApi";
import { logEvent } from "../utils/analytics";

type PageCount = { page: string; count: number };
type SummaryResponse = {
  actionCounts: ActionCount[];
  pageCounts: PageCount[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const PAGE_SIZE = 12;
const SCHEDULE_KEY = "admin_schedule_jobs_v1";

type BulkProgress = {
  label: string;
  total: number;
  done: number;
  failed: number;
  running: boolean;
};

type UndoAction = {
  label: string;
  run: () => Promise<void>;
};

type ScheduledJob = {
  id: string;
  executeAt: string;
  type: "application_status" | "attendance_hidden";
  ids: number[];
  payload: { status?: Application["status"]; hidden?: boolean; reason: string };
};
type AdminTab = "overview" | "behavior" | "moderation" | "attendance" | "operations";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [status, setStatus] = useState<string>("점검 중...");
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [pages, setPages] = useState<PageCount[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AdminAttendanceLogItem[]>([]);
  const [supportInquiries, setSupportInquiries] = useState<SupportInquiryItem[]>([]);
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
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [loadingAttendanceLogs, setLoadingAttendanceLogs] = useState(false);
  const [loadingSupportInquiries, setLoadingSupportInquiries] = useState(false);

  const [changingStatusIds, setChangingStatusIds] = useState<Set<number>>(new Set());
  const [processingAttendanceId, setProcessingAttendanceId] = useState<number | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<Set<number>>(new Set());
  const [selectedGallery, setSelectedGallery] = useState<Set<string>>(new Set());
  const [selectedProteins, setSelectedProteins] = useState<Set<number>>(new Set());
  const [selectedBrags, setSelectedBrags] = useState<Set<number>>(new Set());
  const [selectedAttendance, setSelectedAttendance] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Application["status"]>("REVIEWING");
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [scheduleType, setScheduleType] = useState<ScheduledJob["type"]>("application_status");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState<Application["status"]>("REVIEWING");
  const [scheduleHidden, setScheduleHidden] = useState(true);
  const [healthSummary, setHealthSummary] = useState<{ publicPingOk: boolean; adminPingOk: boolean; lobbyMetricsOk: boolean } | null>(null);
  const [pageApps, setPageApps] = useState(0);
  const [pageAttendance, setPageAttendance] = useState(0);
  const [pageGallery, setPageGallery] = useState(0);
  const [pageProteins, setPageProteins] = useState(0);
  const [pageBrags, setPageBrags] = useState(0);
  const [pageAttendanceLogs, setPageAttendanceLogs] = useState(0);
  const [pageSupportInquiries, setPageSupportInquiries] = useState(0);
  const [totalAppsPages, setTotalAppsPages] = useState(0);
  const [totalAttendancePages, setTotalAttendancePages] = useState(0);
  const [totalGalleryPages, setTotalGalleryPages] = useState(0);
  const [totalProteinPages, setTotalProteinPages] = useState(0);
  const [totalBragPages, setTotalBragPages] = useState(0);
  const [totalAttendanceLogPages, setTotalAttendanceLogPages] = useState(0);
  const [totalSupportInquiryPages, setTotalSupportInquiryPages] = useState(0);
  const [role, setRole] = useState<string>("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventActionFilter, setEventActionFilter] = useState("all");
  const [eventPageFilter, setEventPageFilter] = useState("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [supportInquiryQuery, setSupportInquiryQuery] = useState("");
  const [supportChairmanOnly, setSupportChairmanOnly] = useState(true);
  const [supportStatusFilter, setSupportStatusFilter] = useState<SupportInquiryItem["status"] | "all">("all");
  const [attendanceDidWorkoutFilter, setAttendanceDidWorkoutFilter] = useState<"all" | "true" | "false">("all");
  const [attendanceSharedFilter, setAttendanceSharedFilter] = useState<"all" | "true" | "false">("all");
  const [attendanceFrom, setAttendanceFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [attendanceTo, setAttendanceTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { toast, showError, showSuccess, clearToast } = useAdminToast();

  const maxAction = useMemo(() => actions.reduce((m, a) => Math.max(m, a.count || 0), 0) || 1, [actions]);
  const maxPage = useMemo(() => pages.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1, [pages]);
  const capabilities = useMemo(() => {
    const normalized = role.toUpperCase();
    const root = normalized === "ADMIN" || normalized === "ROLE_ADMIN";
    const content = normalized === "CONTENT_ADMIN" || normalized === "ROLE_CONTENT_ADMIN";
    const support = normalized === "SUPPORT_ADMIN" || normalized === "ROLE_SUPPORT_ADMIN";
    return {
      canDeleteAssets: root || content,
      canModerateApplications: root || support,
      canModerateAttendance: root || support,
    };
  }, [role]);

  const filteredEvents = useMemo(() => {
    const needle = eventQuery.trim().toLowerCase();
    return analyticsEvents.filter((item) => {
      if (eventActionFilter !== "all" && item.action !== eventActionFilter) return false;
      if (eventPageFilter !== "all" && item.page !== eventPageFilter) return false;
      if (!needle) return true;
      return [item.action, item.page, item.metadata || "", item.userEmail || "", item.userNickname || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [analyticsEvents, eventActionFilter, eventPageFilter, eventQuery]);

  const filteredAuditLogs = useMemo(() => {
    const needle = auditQuery.trim().toLowerCase();
    if (!needle) return auditLogs;
    return auditLogs.filter((item) =>
      [item.action, item.resource, item.summary || "", item.metadata || "", item.userEmail || "", item.userNickname || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [auditLogs, auditQuery]);

  useEffect(() => {
    void fetchSummary();
    void loadAnalyticsEvents();
    void loadAuditLogs();
    void loadApplications(pageApps);
    void loadGallery(pageGallery);
    void loadProteins(pageProteins);
    void loadBrags(pageBrags);
    void loadAttendanceShares(pageAttendance);
    void loadAttendanceLogs(pageAttendanceLogs);
    void loadSupportInquiries(pageSupportInquiries);
    void loadHealthSummary();
    void loadMe();
    logEvent("admin_dashboard", "page_view");
  }, []);

  useEffect(() => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduledJobs));
  }, [scheduledJobs]);

  useEffect(() => {
    void loadApplications(pageApps);
  }, [pageApps]);
  useEffect(() => {
    void loadGallery(pageGallery);
  }, [pageGallery]);
  useEffect(() => {
    void loadProteins(pageProteins);
  }, [pageProteins]);
  useEffect(() => {
    void loadBrags(pageBrags);
  }, [pageBrags]);
  useEffect(() => {
    void loadAttendanceShares(pageAttendance);
  }, [pageAttendance]);
  useEffect(() => {
    void loadAttendanceLogs(pageAttendanceLogs);
  }, [pageAttendanceLogs]);
  useEffect(() => {
    void loadSupportInquiries(pageSupportInquiries);
  }, [pageSupportInquiries]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void executeDueSchedule();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [scheduledJobs, bulkProgress]);

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

  const loadHealthSummary = async () => {
    try {
      const data = await adminApi.getHealthSummary();
      setHealthSummary(data);
    } catch {
      setHealthSummary(null);
    }
  };

  const loadSummaryAndHealth = async () => {
    await Promise.all([fetchSummary(), loadHealthSummary(), loadAnalyticsEvents(), loadAuditLogs(), loadAttendanceLogs(pageAttendanceLogs), loadSupportInquiries(pageSupportInquiries)]);
  };

  const loadAnalyticsEvents = async () => {
    try {
      setLoadingEvents(true);
      const data = await adminApi.getAnalyticsEvents(500);
      setAnalyticsEvents(data ?? []);
    } catch (e: any) {
      showError(e?.message || "행동 이벤트를 불러오지 못했습니다.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const data = await adminApi.getAudit(500);
      setAuditLogs(data ?? []);
    } catch (e: any) {
      showError(e?.message || "감사 로그를 불러오지 못했습니다.");
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const loadAttendanceLogs = async (page = pageAttendanceLogs) => {
    try {
      setLoadingAttendanceLogs(true);
      const didWorkout = attendanceDidWorkoutFilter === "all" ? null : attendanceDidWorkoutFilter === "true";
      const shared = attendanceSharedFilter === "all" ? null : attendanceSharedFilter === "true";
      const data = await adminApi.getAttendanceLogs({
        page,
        size: PAGE_SIZE,
        query: attendanceQuery,
        didWorkout,
        shared,
        from: attendanceFrom,
        to: attendanceTo,
      });
      setAttendanceLogs(data.content ?? []);
      setTotalAttendanceLogPages(data.totalPages ?? 1);
      setPageAttendanceLogs(data.number ?? page);
    } catch (e: any) {
      showError(e?.message || "출석 원본 로그를 불러오지 못했습니다.");
    } finally {
      setLoadingAttendanceLogs(false);
    }
  };

  const loadSupportInquiries = async (page = pageSupportInquiries) => {
    try {
      setLoadingSupportInquiries(true);
      const data = await adminApi.getSupportInquiries({
        page,
        size: PAGE_SIZE,
        query: supportInquiryQuery,
        chairmanOnly: supportChairmanOnly,
        status: supportStatusFilter,
      });
      setSupportInquiries(data.content ?? []);
      setTotalSupportInquiryPages(data.totalPages ?? 1);
      setPageSupportInquiries(data.number ?? page);
    } catch (e: any) {
      showError(e?.message || "문의/제안 데이터를 불러오지 못했습니다.");
    } finally {
      setLoadingSupportInquiries(false);
    }
  };

  const updateSupportInquiryStatus = async (item: SupportInquiryItem, nextStatus: SupportInquiryItem["status"]) => {
    const defaultNote = item.adminNote || "";
    const note = window.prompt("관리 메모(선택)를 입력하세요.", defaultNote);
    if (note === null) return;
    try {
      await adminApi.updateSupportInquiryStatus(item.id, {
        status: nextStatus,
        adminNote: note.trim() || undefined,
      });
      showSuccess("문의 상태를 업데이트했습니다.");
      await loadSupportInquiries(pageSupportInquiries);
    } catch (e: any) {
      showError(e?.message || "문의 상태 업데이트에 실패했습니다.");
    }
  };

  const loadMe = async () => {
    try {
      const me = await adminApi.getMe();
      setRole(me.role || "");
    } catch {
      setRole("");
    }
  };

  const runBulkWithProgress = async <T,>(label: string, ids: T[], task: (id: T) => Promise<void>) => {
    setBulkProgress({ label, total: ids.length, done: 0, failed: 0, running: true });
    let done = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await task(id);
      } catch {
        failed += 1;
      } finally {
        done += 1;
        setBulkProgress({ label, total: ids.length, done, failed, running: true });
      }
    }
    setBulkProgress((prev) => (prev ? { ...prev, running: false } : prev));
    return { done: done - failed, failed };
  };

  const writeAudit = async (action: string, resource: string, summary: string, reason: string) => {
    try {
      await adminApi.writeManualAudit({ action, resource, summary, metadata: `reason=${reason}` });
    } catch {
      // no-op
    }
  };

  const exportCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return showError("내보낼 데이터가 없습니다.");
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, "\"\"")}"`).join(","))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const loadApplications = async (page = pageApps) => {
    try {
      setLoadingApps(true);
      const res = await adminApi.getApplications(page, PAGE_SIZE);
      const data = Array.isArray((res as any).content) ? (res as any).content : (res as any);
      setApplications(data as Application[]);
      setTotalAppsPages((res as any).totalPages ?? 1);
      setPageApps((res as any).number ?? page);
    } catch (e: any) {
      showError(e?.message || "신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingApps(false);
    }
  };

  const updateStatus = async (id: number, nextStatus: Application["status"]) => {
    const reason = window.prompt("상태 변경 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    try {
      toChangingSet(setChangingStatusIds, id, true);
      const prev = applications.find((a) => a.id === id)?.status;
      await adminApi.updateApplicationStatus(id, nextStatus);
      await loadApplications();
      await writeAudit("APPLICATION_STATUS_CHANGE", "programs/applications", `id=${id} -> ${nextStatus}`, reason.trim());
      showSuccess("신청 상태를 변경했습니다.");
      if (prev) {
        setUndoAction({
          label: `신청 #${id} 상태 변경`,
          run: async () => {
            await adminApi.updateApplicationStatus(id, prev);
            await loadApplications();
            setUndoAction(null);
          },
        });
      }
    } catch (e: any) {
      showError(e?.message || "상태 변경에 실패했습니다.");
    } finally {
      toChangingSet(setChangingStatusIds, id, false);
    }
  };

  const loadGallery = async (page = pageGallery) => {
    try {
      setLoadingGallery(true);
      const res = await adminApi.getGallery(page, PAGE_SIZE);
      setGallery(res.content ?? []);
      setTotalGalleryPages(res.totalPages ?? 1);
      setPageGallery(res.number ?? page);
    } catch (e: any) {
      showError(e?.message || "갤러리 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingGallery(false);
    }
  };

  const loadProteins = async (page = pageProteins) => {
    try {
      setLoadingProteins(true);
      const data = await adminApi.getProteins(page, PAGE_SIZE);
      setProteins(data.content ?? []);
      setTotalProteinPages(data.totalPages ?? 1);
      setPageProteins(data.number ?? page);
    } catch (e: any) {
      showError(e?.message || "단백질 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingProteins(false);
    }
  };

  const loadBrags = async (page = pageBrags) => {
    try {
      setLoadingBrags(true);
      const data = await adminApi.getBrags(page, PAGE_SIZE);
      setBrags(data.content ?? []);
      setTotalBragPages(data.totalPages ?? 1);
      setPageBrags(data.number ?? page);
    } catch (e: any) {
      showError(e?.message || "자랑방 목록을 불러오지 못했습니다.");
    } finally {
      setLoadingBrags(false);
    }
  };

  const loadAttendanceShares = async (page = pageAttendance) => {
    try {
      setLoadingAttendanceShares(true);
      const data = await adminApi.getAttendanceShares(page, PAGE_SIZE);
      setAttendanceShares(data.content ?? []);
      setTotalAttendancePages(data.totalPages ?? 1);
      setPageAttendance(data.number ?? page);
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

  const bulkDeleteGallery = async () => {
    const reason = window.prompt("갤러리 일괄 삭제 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    const targets = [...selectedGallery];
    if (targets.length === 0) return showError("선택한 파일이 없습니다.");
    if (!(await confirmDangerousAction(`갤러리 ${targets.length}건 삭제`))) return;
    const result = await runBulkWithProgress("갤러리 일괄 삭제", targets, async (url) => {
      await adminApi.deleteGalleryItem(url);
    });
    await loadGallery(pageGallery);
    await writeAudit("BULK_GALLERY_DELETE", "files/gallery", `${targets.length}건`, reason.trim());
    if (result.failed === 0) showSuccess(`${result.done}건 삭제 완료`);
    else showError(`${result.done}건 성공, ${result.failed}건 실패`);
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

  const bulkDeleteProtein = async () => {
    const reason = window.prompt("상품 일괄 삭제 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    const targets = [...selectedProteins];
    if (targets.length === 0) return showError("선택한 상품이 없습니다.");
    if (!(await confirmDangerousAction(`상품 ${targets.length}건 삭제`))) return;
    const result = await runBulkWithProgress("상품 일괄 삭제", targets, async (pid) => {
      await adminApi.deleteProtein(pid);
    });
    await loadProteins(pageProteins);
    await writeAudit("BULK_PROTEIN_DELETE", "proteins", `${targets.length}건`, reason.trim());
    if (result.failed === 0) showSuccess(`${result.done}건 삭제 완료`);
    else showError(`${result.done}건 성공, ${result.failed}건 실패`);
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

  const bulkDeleteBrag = async () => {
    const reason = window.prompt("게시글 일괄 삭제 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    const targets = [...selectedBrags];
    if (targets.length === 0) return showError("선택한 게시글이 없습니다.");
    if (!(await confirmDangerousAction(`게시글 ${targets.length}건 삭제`))) return;
    const result = await runBulkWithProgress("게시글 일괄 삭제", targets, async (bid) => {
      await adminApi.deleteBrag(bid);
    });
    await loadBrags(pageBrags);
    await writeAudit("BULK_BRAG_DELETE", "brags", `${targets.length}건`, reason.trim());
    if (result.failed === 0) showSuccess(`${result.done}건 삭제 완료`);
    else showError(`${result.done}건 성공, ${result.failed}건 실패`);
  };

  const bulkUpdateApplicationStatus = async () => {
    if (!capabilities.canModerateApplications) return showError("권한이 없습니다.");
    const reason = window.prompt("신청 상태 일괄 변경 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    const targets = [...selectedApplications];
    if (targets.length === 0) return showError("선택한 신청이 없습니다.");
    if (!(await confirmDangerousAction(`신청 ${targets.length}건 상태 변경`))) return;
    const prevMap = new Map<number, Application["status"]>();
    applications.forEach((a) => {
      if (targets.includes(a.id)) prevMap.set(a.id, a.status);
    });
    const result = await runBulkWithProgress("신청 상태 일괄 변경", targets, async (aid) => {
      await adminApi.updateApplicationStatus(aid, bulkStatus);
    });
    await loadApplications(pageApps);
    await writeAudit("BULK_APPLICATION_STATUS", "programs/applications", `${targets.length}건 -> ${bulkStatus}`, reason.trim());
    if (result.failed === 0) {
      showSuccess(`${result.done}건 변경 완료`);
      setUndoAction({
        label: "신청 일괄 상태 변경",
        run: async () => {
          const ids = [...prevMap.keys()];
          await runBulkWithProgress("신청 상태 되돌리기", ids, async (aid) => {
            const prev = prevMap.get(aid);
            if (prev) await adminApi.updateApplicationStatus(aid, prev);
          });
          await loadApplications(pageApps);
          setUndoAction(null);
        },
      });
    } else {
      showError(`${result.done}건 성공, ${result.failed}건 실패`);
    }
  };

  const bulkSetAttendanceHidden = async (hidden: boolean) => {
    if (!capabilities.canModerateAttendance) return showError("권한이 없습니다.");
    const reason = window.prompt(hidden ? "출석 공유 비공개 사유를 입력하세요." : "출석 공유 공개 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    const targets = [...selectedAttendance];
    if (targets.length === 0) return showError("선택한 항목이 없습니다.");
    const ok = hidden
      ? await confirmDangerousAction(`출석 공유 ${targets.length}건 비공개`)
      : window.confirm(`출석 공유 ${targets.length}건을 공개할까요?`);
    if (!ok) return;
    const prevMap = new Map<number, boolean>();
    attendanceShares.forEach((a) => {
      if (targets.includes(a.id)) prevMap.set(a.id, Boolean(a.hiddenByAdmin));
    });
    const result = await runBulkWithProgress("출석 공유 일괄 처리", targets, async (aid) => {
      await adminApi.setAttendanceHidden(aid, hidden);
    });
    await loadAttendanceShares(pageAttendance);
    await writeAudit(hidden ? "BULK_ATTENDANCE_HIDE" : "BULK_ATTENDANCE_SHOW", "attendance/shares", `${targets.length}건`, reason.trim());
    if (result.failed === 0) {
      showSuccess(`${result.done}건 처리 완료`);
      setUndoAction({
        label: "출석 공유 일괄 변경",
        run: async () => {
          const ids = [...prevMap.keys()];
          await runBulkWithProgress("출석 공유 되돌리기", ids, async (aid) => {
            await adminApi.setAttendanceHidden(aid, Boolean(prevMap.get(aid)));
          });
          await loadAttendanceShares(pageAttendance);
          setUndoAction(null);
        },
      });
    } else {
      showError(`${result.done}건 성공, ${result.failed}건 실패`);
    }
  };

  const executeDueSchedule = async () => {
    if (bulkProgress?.running) return;
    const due = scheduledJobs.filter((job) => new Date(job.executeAt).getTime() <= Date.now());
    if (due.length === 0) return;
    for (const job of due) {
      if (job.type === "application_status" && job.payload.status) {
        await runBulkWithProgress("예약 신청 상태 변경", job.ids, async (aid) => {
          await adminApi.updateApplicationStatus(aid, job.payload.status as Application["status"]);
        });
      }
      if (job.type === "attendance_hidden" && typeof job.payload.hidden === "boolean") {
        await runBulkWithProgress("예약 출석 처리", job.ids, async (aid) => {
          await adminApi.setAttendanceHidden(aid, Boolean(job.payload.hidden));
        });
      }
    }
    await loadApplications(pageApps);
    await loadAttendanceShares(pageAttendance);
    setScheduledJobs((prev) => prev.filter((x) => !due.some((d) => d.id === x.id)));
    showSuccess(`${due.length}건의 예약 작업을 실행했습니다.`);
  };

  const createSchedule = () => {
    const reason = window.prompt("예약 작업 사유를 입력하세요.");
    if (!reason || !reason.trim()) return;
    if (!scheduleDateTime) return showError("예약 시간을 선택해 주세요.");

    if (scheduleType === "application_status") {
      const ids = [...selectedApplications];
      if (ids.length === 0) return showError("신청 항목을 선택해 주세요.");
      setScheduledJobs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          executeAt: scheduleDateTime,
          type: "application_status",
          ids,
          payload: { status: scheduleStatus, reason: reason.trim() },
        },
      ]);
      showSuccess(`신청 상태 예약 ${ids.length}건을 등록했습니다.`);
      return;
    }

    const ids = [...selectedAttendance];
    if (ids.length === 0) return showError("출석 공유 항목을 선택해 주세요.");
    setScheduledJobs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        executeAt: scheduleDateTime,
        type: "attendance_hidden",
        ids,
        payload: { hidden: scheduleHidden, reason: reason.trim() },
      },
    ]);
    showSuccess(`출석 공유 예약 ${ids.length}건을 등록했습니다.`);
  };

  const setAttendanceHidden = async (id: number, hidden: boolean) => {
    const reason = hidden ? window.prompt("비공개 처리 사유를 입력하세요.") : "manual-show";
    if (!reason || !reason.trim()) return;
    const ok = hidden
      ? await confirmDangerousAction("출석 공유 비공개")
      : window.confirm("해당 출석 공유를 다시 공개할까요?");
    if (!ok) return;

    try {
      setProcessingAttendanceId(id);
      const prev = Boolean(attendanceShares.find((it) => it.id === id)?.hiddenByAdmin);
      await adminApi.setAttendanceHidden(id, hidden);
      await loadAttendanceShares();
      await writeAudit(hidden ? "ATTENDANCE_HIDE" : "ATTENDANCE_SHOW", "attendance/shares", `id=${id} hidden=${hidden}`, reason.trim());
      showSuccess(hidden ? "비공개 처리했습니다." : "공개 처리했습니다.");
      setUndoAction({
        label: `출석 공유 #${id} 변경`,
        run: async () => {
          await adminApi.setAttendanceHidden(id, prev);
          await loadAttendanceShares();
          setUndoAction(null);
        },
      });
    } catch (e: any) {
      showError(e?.message || "처리에 실패했습니다.");
    } finally {
      setProcessingAttendanceId(null);
    }
  };

  const statuses: Application["status"][] = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"];
  const applyAttendanceFilters = () => {
    setPageAttendanceLogs(0);
    void loadAttendanceLogs(0);
  };

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

        <div className="sticky top-16 z-20 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/85 p-2 backdrop-blur">
          <div className="flex min-w-max gap-2">
            {([
              ["overview", "개요"],
              ["behavior", "행동 추적"],
              ["moderation", "검수/콘텐츠"],
              ["attendance", "출석 기록"],
              ["operations", "운영 자동화"],
            ] as Array<[AdminTab, string]>).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
        <>
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

        <div className="grid gap-6 lg:grid-cols-2">
          <MediaPanel title="알림 센터" description="운영 임계치 기반 경고" loading={false} hasData={true} onRefresh={() => void loadSummaryAndHealth()} emptyMessage="">
            <div className="space-y-2 text-sm">
              {!healthSummary?.adminPingOk && <div className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-rose-100">관리자 API 상태가 불안정합니다.</div>}
              {applications.filter((a) => a.status === "PENDING").length >= 5 && <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-amber-100">검토 대기 신청이 5건 이상입니다.</div>}
              {attendanceShares.filter((it) => it.reportCount >= 5).length > 0 && <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-amber-100">신고 다수 출석 공유가 존재합니다.</div>}
              {scheduledJobs.length > 0 && <div className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-cyan-100">예약 작업 {scheduledJobs.length}건 대기 중</div>}
              {healthSummary && (
                <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                  <div className={`rounded-md px-2 py-1 ${healthSummary.publicPingOk ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>/ping</div>
                  <div className={`rounded-md px-2 py-1 ${healthSummary.adminPingOk ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>/api/admin/ping</div>
                  <div className={`rounded-md px-2 py-1 ${healthSummary.lobbyMetricsOk ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/20 text-rose-100"}`}>/api/metrics/lobby</div>
                </div>
              )}
            </div>
          </MediaPanel>

          <MediaPanel title="예약 작업" description="선택 항목 예약 실행" loading={false} hasData={true} onRefresh={() => void executeDueSchedule()} emptyMessage="">
            <div className="grid gap-2 md:grid-cols-2">
              <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ScheduledJob["type"])} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                <option value="application_status">신청 상태 변경</option>
                <option value="attendance_hidden">출석 공유 공개/비공개</option>
              </select>
              {scheduleType === "application_status" ? (
                <select value={scheduleStatus} onChange={(e) => setScheduleStatus(e.target.value as Application["status"])} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <select value={String(scheduleHidden)} onChange={(e) => setScheduleHidden(e.target.value === "true")} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                  <option value="true">비공개</option>
                  <option value="false">공개</option>
                </select>
              )}
              <input type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
              <button type="button" onClick={createSchedule} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">예약 생성</button>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {scheduledJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                  {new Date(job.executeAt).toLocaleString("ko-KR")} · {job.type} · {job.ids.length}건
                </div>
              ))}
              {scheduledJobs.length > 5 && <p className="text-gray-400">+{scheduledJobs.length - 5}건 더 있음</p>}
            </div>
          </MediaPanel>
        </div>
        </>
        )}

        {(activeTab === "operations" || activeTab === "moderation" || activeTab === "attendance") && undoAction && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-amber-100">최근 작업: {undoAction.label}</p>
              <button type="button" onClick={() => void undoAction.run()} className="rounded-lg bg-amber-300 px-3 py-1.5 text-sm font-semibold text-slate-900">Undo</button>
            </div>
          </div>
        )}

        {(activeTab === "operations" || activeTab === "moderation" || activeTab === "attendance") && bulkProgress && (
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-cyan-100">진행 중: {bulkProgress.label}</p>
            <p className="mt-1 text-xs text-cyan-100">{bulkProgress.done}/{bulkProgress.total} 완료 · 실패 {bulkProgress.failed}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {activeTab === "behavior" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <MediaPanel title="행동 이벤트 추적" description="유저 행동 로그 검색/필터" loading={loadingEvents} hasData={filteredEvents.length > 0} onRefresh={() => void loadAnalyticsEvents()} emptyMessage="행동 로그가 없습니다.">
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                <input value={eventQuery} onChange={(e) => setEventQuery(e.target.value)} placeholder="유저/메타데이터 검색" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
                <select value={eventActionFilter} onChange={(e) => setEventActionFilter(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                  <option value="all">모든 액션</option>
                  {[...new Set(analyticsEvents.map((item) => item.action))].slice(0, 120).map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select value={eventPageFilter} onChange={(e) => setEventPageFilter(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm md:col-span-2">
                  <option value="all">모든 페이지</option>
                  {[...new Set(analyticsEvents.map((item) => item.page))].slice(0, 120).map((pageName) => (
                    <option key={pageName} value={pageName}>{pageName}</option>
                  ))}
                </select>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {filteredEvents.slice(0, 220).map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-sm font-semibold text-white">{item.action} · {item.page}</p>
                    <p className="text-xs text-gray-300">{item.userNickname || "익명"} {item.userEmail ? `(${item.userEmail})` : ""} · {new Date(item.createdAt).toLocaleString("ko-KR")}</p>
                    {item.metadata ? <p className="mt-1 break-words text-xs text-gray-400">{item.metadata}</p> : null}
                  </div>
                ))}
              </div>
            </MediaPanel>

            <MediaPanel title="감사 로그 추적" description="관리자 액션/사유 조회" loading={loadingAuditLogs} hasData={filteredAuditLogs.length > 0} onRefresh={() => void loadAuditLogs()} emptyMessage="감사 로그가 없습니다.">
              <input value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="액션/리소스/사용자 검색" className="mb-3 w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {filteredAuditLogs.slice(0, 220).map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-sm font-semibold text-cyan-100">{item.action}</p>
                    <p className="text-xs text-gray-300">{item.resource} · {item.userNickname || "익명"} · {new Date(item.createdAt).toLocaleString("ko-KR")}</p>
                    {item.summary ? <p className="mt-1 text-xs text-gray-400">{item.summary}</p> : null}
                  </div>
                ))}
              </div>
            </MediaPanel>
          </div>
        )}

        {activeTab === "behavior" && (
          <MediaPanel title="문의/회장에게 한마디" description="챗봇 문의와 회장 메시지 조회" loading={loadingSupportInquiries} hasData={supportInquiries.length > 0} onRefresh={() => void loadSupportInquiries(pageSupportInquiries)} emptyMessage="수집된 문의가 없습니다.">
            <div className="mb-3 grid gap-2 md:grid-cols-5">
              <input value={supportInquiryQuery} onChange={(e) => setSupportInquiryQuery(e.target.value)} placeholder="이름/이메일/메시지 검색" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm md:col-span-2" />
              <select value={supportStatusFilter} onChange={(e) => setSupportStatusFilter(e.target.value as SupportInquiryItem["status"] | "all")} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                <option value="all">모든 상태</option>
                <option value="OPEN">OPEN</option>
                <option value="READ">READ</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                <input type="checkbox" checked={supportChairmanOnly} onChange={(e) => setSupportChairmanOnly(e.target.checked)} />
                회장 메시지만
              </label>
              <button type="button" onClick={() => { setPageSupportInquiries(0); void loadSupportInquiries(0); }} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">검색</button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {supportInquiries.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.name || "익명"} {item.email ? `(${item.email})` : ""}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.status === "RESOLVED" ? "bg-emerald-500/25 text-emerald-100" :
                      item.status === "IN_PROGRESS" ? "bg-cyan-500/25 text-cyan-100" :
                      item.status === "READ" ? "bg-amber-500/25 text-amber-100" :
                      "bg-rose-500/25 text-rose-100"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">{item.page || "-"} · {new Date(item.createdAt).toLocaleString("ko-KR")}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-100">{item.message}</p>
                  {item.adminNote ? <p className="mt-1 whitespace-pre-wrap text-xs text-cyan-100">메모: {item.adminNote}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void updateSupportInquiryStatus(item, "READ")} className="rounded-full border border-white/20 px-2 py-1 text-[11px]">읽음</button>
                    <button type="button" onClick={() => void updateSupportInquiryStatus(item, "IN_PROGRESS")} className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100">처리중</button>
                    <button type="button" onClick={() => void updateSupportInquiryStatus(item, "RESOLVED")} className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">해결완료</button>
                    {item.handledAt ? <span className="text-[11px] text-gray-400">처리일: {new Date(item.handledAt).toLocaleString("ko-KR")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={pageSupportInquiries} totalPages={totalSupportInquiryPages} onChange={setPageSupportInquiries} />
          </MediaPanel>
        )}

        {activeTab === "operations" && (
          <MediaPanel title="자동화 / 시스템 운영" description="예약 작업, 상태 점검, 이력 동기화" loading={false} hasData={true} onRefresh={() => void loadSummaryAndHealth()} emptyMessage="">
            <div className="grid gap-2 md:grid-cols-2">
              <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ScheduledJob["type"])} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                <option value="application_status">신청 상태 변경</option>
                <option value="attendance_hidden">출석 공유 공개/비공개</option>
              </select>
              {scheduleType === "application_status" ? (
                <select value={scheduleStatus} onChange={(e) => setScheduleStatus(e.target.value as Application["status"])} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <select value={String(scheduleHidden)} onChange={(e) => setScheduleHidden(e.target.value === "true")} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
                  <option value="true">비공개</option>
                  <option value="false">공개</option>
                </select>
              )}
              <input type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
              <button type="button" onClick={createSchedule} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">예약 생성</button>
              <button type="button" onClick={() => void executeDueSchedule()} className="rounded-lg border border-white/20 px-3 py-2 text-sm">지금 실행</button>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {scheduledJobs.slice(0, 10).map((job) => (
                <div key={job.id} className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                  {new Date(job.executeAt).toLocaleString("ko-KR")} · {job.type} · {job.ids.length}건
                </div>
              ))}
              {scheduledJobs.length === 0 && <p className="text-gray-400">예약 작업이 없습니다.</p>}
            </div>
          </MediaPanel>
        )}

        {activeTab === "moderation" && (
        <MediaPanel
          title="프로그램 신청"
          description="다중 선택 / 일괄 상태 변경 / CSV"
          loading={loadingApps}
          hasData={applications.length > 0}
          onRefresh={() => void loadApplications(pageApps)}
          emptyMessage="신청 내역이 없습니다."
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as Application["status"])} className="rounded-lg border border-white/20 bg-slate-900 px-2 py-1 text-xs">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" disabled={!capabilities.canModerateApplications} onClick={() => void bulkUpdateApplicationStatus()} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40">선택 상태변경 ({selectedApplications.size})</button>
            <button type="button" onClick={() => exportCsv("applications", applications.map((a) => ({ id: a.id, name: a.name, email: a.email, status: a.status, track: a.track, createdAt: a.createdAt })))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">CSV</button>
            <label className="text-xs text-gray-300"><input type="checkbox" className="mr-1" checked={applications.length > 0 && selectedApplications.size === applications.length} onChange={(e) => setSelectedApplications(e.target.checked ? new Set(applications.map((a) => a.id)) : new Set())} />현재 페이지 전체</label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {applications.map((app) => (
              <div key={app.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{app.name}</p>
                    <p className="text-xs text-gray-300">{app.email}</p>
                  </div>
                  <label className="text-xs text-gray-200"><input type="checkbox" className="mr-1" checked={selectedApplications.has(app.id)} onChange={() => toggleNumberSet(setSelectedApplications, app.id)} />선택</label>
                </div>
                <p className="mt-2 text-sm text-gray-200">목표: {app.goal}</p>
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value as Application["status"])}
                  disabled={changingStatusIds.has(app.id)}
                  className="mt-3 w-full rounded-lg border border-gray-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
          <Pagination page={pageApps} totalPages={totalAppsPages} onChange={setPageApps} />
        </MediaPanel>
        )}

        {activeTab === "moderation" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <MediaPanel
            title="갤러리 관리"
            description="업로드 파일 확인 / 다중 삭제 / CSV"
            loading={loadingGallery}
            hasData={gallery.length > 0}
            onRefresh={() => void loadGallery(pageGallery)}
            emptyMessage="갤러리 파일이 없습니다."
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!capabilities.canDeleteAssets} onClick={() => void bulkDeleteGallery()} className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs disabled:opacity-40">선택 삭제 ({selectedGallery.size})</button>
              <button type="button" onClick={() => exportCsv("gallery", gallery.map((url) => ({ url })))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">CSV</button>
              <label className="text-xs text-gray-300"><input type="checkbox" className="mr-1" checked={gallery.length > 0 && selectedGallery.size === gallery.length} onChange={(e) => setSelectedGallery(e.target.checked ? new Set(gallery) : new Set())} />현재 페이지 전체</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {gallery.map((url) => (
                <div key={url} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  <img src={url} alt="gallery" className="h-32 w-full object-cover" />
                  <label className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs">
                    <input type="checkbox" className="mr-1" checked={selectedGallery.has(url)} onChange={() => toggleStringSet(setSelectedGallery, url)} />
                    선택
                  </label>
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
            <Pagination page={pageGallery} totalPages={totalGalleryPages} onChange={setPageGallery} />
          </MediaPanel>

          <MediaPanel
            title="단백질 상품 관리"
            description="등록 상품 목록 / 다중 삭제 / CSV"
            loading={loadingProteins}
            hasData={proteins.length > 0}
            onRefresh={() => void loadProteins(pageProteins)}
            emptyMessage="표시할 상품이 없습니다."
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!capabilities.canDeleteAssets} onClick={() => void bulkDeleteProtein()} className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs disabled:opacity-40">선택 삭제 ({selectedProteins.size})</button>
              <button type="button" onClick={() => exportCsv("proteins", proteins.map((p) => ({ id: p.id, name: p.name })))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">CSV</button>
              <label className="text-xs text-gray-300"><input type="checkbox" className="mr-1" checked={proteins.length > 0 && selectedProteins.size === proteins.length} onChange={(e) => setSelectedProteins(e.target.checked ? new Set(proteins.map((p) => p.id)) : new Set())} />현재 페이지 전체</label>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {proteins.map((protein) => (
                <div key={protein.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-sm text-white">{protein.name}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-200"><input type="checkbox" className="mr-1" checked={selectedProteins.has(protein.id)} onChange={() => toggleNumberSet(setSelectedProteins, protein.id)} />선택</label>
                    <button type="button" onClick={() => void deleteProtein(protein.id)} className="rounded-full bg-red-500/85 px-3 py-1 text-xs text-white hover:opacity-90">삭제</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={pageProteins} totalPages={totalProteinPages} onChange={setPageProteins} />
          </MediaPanel>

          <MediaPanel
            title="자랑방 관리"
            description="게시글 목록 / 다중 삭제 / CSV"
            loading={loadingBrags}
            hasData={brags.length > 0}
            onRefresh={() => void loadBrags(pageBrags)}
            emptyMessage="표시할 게시글이 없습니다."
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!capabilities.canDeleteAssets} onClick={() => void bulkDeleteBrag()} className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs disabled:opacity-40">선택 삭제 ({selectedBrags.size})</button>
              <button type="button" onClick={() => exportCsv("brags", brags.map((b) => ({ id: b.id, title: b.title })))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">CSV</button>
              <label className="text-xs text-gray-300"><input type="checkbox" className="mr-1" checked={brags.length > 0 && selectedBrags.size === brags.length} onChange={(e) => setSelectedBrags(e.target.checked ? new Set(brags.map((b) => b.id)) : new Set())} />현재 페이지 전체</label>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {brags.map((brag) => (
                <div key={brag.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="truncate pr-2 text-sm text-white">{brag.title || `자랑글 #${brag.id}`}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-200"><input type="checkbox" className="mr-1" checked={selectedBrags.has(brag.id)} onChange={() => toggleNumberSet(setSelectedBrags, brag.id)} />선택</label>
                    <button type="button" onClick={() => void deleteBrag(brag.id)} className="rounded-full bg-red-500/85 px-3 py-1 text-xs text-white hover:opacity-90">삭제</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={pageBrags} totalPages={totalBragPages} onChange={setPageBrags} />
          </MediaPanel>
        </div>
        )}

        {activeTab === "attendance" && (
        <>
        <MediaPanel
          title="출석 원본 로그"
          description="공유 여부와 무관한 전체 출석 로그 조회"
          loading={loadingAttendanceLogs}
          hasData={attendanceLogs.length > 0}
          onRefresh={() => void loadAttendanceLogs(pageAttendanceLogs)}
          emptyMessage="출석 로그가 없습니다."
        >
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <input value={attendanceQuery} onChange={(e) => setAttendanceQuery(e.target.value)} placeholder="닉네임/이메일 검색" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm md:col-span-2" />
            <button type="button" onClick={applyAttendanceFilters} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">필터 적용</button>
            <select value={attendanceDidWorkoutFilter} onChange={(e) => setAttendanceDidWorkoutFilter(e.target.value as "all" | "true" | "false")} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
              <option value="all">운동여부 전체</option>
              <option value="true">운동함</option>
              <option value="false">운동안함</option>
            </select>
            <select value={attendanceSharedFilter} onChange={(e) => setAttendanceSharedFilter(e.target.value as "all" | "true" | "false")} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
              <option value="all">공유여부 전체</option>
              <option value="true">공유됨</option>
              <option value="false">미공유</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={attendanceFrom} onChange={(e) => setAttendanceFrom(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
              <input type="date" value={attendanceTo} onChange={(e) => setAttendanceTo(e.target.value)} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {attendanceLogs.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <p className="font-semibold text-white">{item.userNickname || "회원"} · {item.date}</p>
                <p className="text-xs text-gray-300">{item.userEmail || "-"} · {item.didWorkout ? "운동함" : "운동안함"} · {item.shared ? "공유됨" : "미공유"}</p>
                <p className="text-xs text-gray-400">응원 {item.cheerCount} · 신고 {item.reportCount} · 수정 {item.editCount}</p>
              </div>
            ))}
          </div>
          <Pagination page={pageAttendanceLogs} totalPages={totalAttendanceLogPages} onChange={setPageAttendanceLogs} />
        </MediaPanel>

        <MediaPanel
          title="출석 공유 운영"
          description="다중 선택 / 일괄 공개·비공개 / CSV"
          loading={loadingAttendanceShares}
          hasData={attendanceShares.length > 0}
          onRefresh={() => void loadAttendanceShares(pageAttendance)}
          emptyMessage="출석 공유 항목이 없습니다."
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!capabilities.canModerateAttendance} onClick={() => void bulkSetAttendanceHidden(true)} className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs disabled:opacity-40">선택 비공개 ({selectedAttendance.size})</button>
            <button type="button" disabled={!capabilities.canModerateAttendance} onClick={() => void bulkSetAttendanceHidden(false)} className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs disabled:opacity-40">선택 공개 ({selectedAttendance.size})</button>
            <button type="button" onClick={() => exportCsv("attendance-shares", attendanceShares.map((it) => ({ id: it.id, date: it.date, author: it.authorNickname, cheerCount: it.cheerCount, reportCount: it.reportCount, hiddenByAdmin: it.hiddenByAdmin })))} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs">CSV</button>
            <label className="text-xs text-gray-300"><input type="checkbox" className="mr-1" checked={attendanceShares.length > 0 && selectedAttendance.size === attendanceShares.length} onChange={(e) => setSelectedAttendance(e.target.checked ? new Set(attendanceShares.map((it) => it.id)) : new Set())} />현재 페이지 전체</label>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {attendanceShares.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-sm text-white">
                  <p>{item.authorNickname || "회원"} · {item.date}</p>
                  <p className="text-xs text-gray-400">응원 {item.cheerCount} · 신고 {item.reportCount}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-200"><input type="checkbox" className="mr-1" checked={selectedAttendance.has(item.id)} onChange={() => toggleNumberSet(setSelectedAttendance, item.id)} />선택</label>
                  {item.hiddenByAdmin ? (
                    <button type="button" onClick={() => setAttendanceHidden(item.id, false)} disabled={processingAttendanceId === item.id} className="rounded-full bg-emerald-500/80 px-3 py-1 text-xs text-white disabled:opacity-60">공개</button>
                  ) : (
                    <button type="button" onClick={() => setAttendanceHidden(item.id, true)} disabled={processingAttendanceId === item.id} className="rounded-full bg-red-500/80 px-3 py-1 text-xs text-white disabled:opacity-60">비공개</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={pageAttendance} totalPages={totalAttendancePages} onChange={setPageAttendance} />
        </MediaPanel>
        </>
        )}
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (next: number) => void }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(0, page - 1))} disabled={page <= 0} className="rounded bg-white/10 px-3 py-1 text-xs disabled:opacity-40">이전</button>
      <span className="text-xs">{page + 1} / {totalPages}</span>
      <button type="button" onClick={() => onChange(Math.min(totalPages - 1, page + 1))} disabled={page + 1 >= totalPages} className="rounded bg-white/10 px-3 py-1 text-xs disabled:opacity-40">다음</button>
    </div>
  );
}

function toggleNumberSet(setter: Dispatch<SetStateAction<Set<number>>>, value: number) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function toggleStringSet(setter: Dispatch<SetStateAction<Set<string>>>, value: string) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}


