import { api } from "../lib/api";

type ActionCount = { action: string; count: number };
type PageCount = { page: string; count: number };

type SummaryResponse = {
  actionCounts: ActionCount[];
  pageCounts: PageCount[];
};

export type PagedResult<T> = {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
  size: number;
};

export type Application = {
  id: number;
  name: string;
  email: string;
  goal: string;
  track: string;
  commitment: string;
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export type ProteinItem = { id: number; name: string };
export type BragItem = { id: number; title: string };
export type AttendanceShareItem = {
  id: number;
  date: string;
  didWorkout?: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[];
  workoutIntensity?: string | null;
  mediaUrls?: string[];
  authorNickname?: string | null;
  cheerCount: number;
  reportCount: number;
  shareSlug?: string | null;
  hiddenByAdmin?: boolean;
  lastEditedAt?: string | null;
  updatedAt?: string | null;
  currentStreak?: number | null;
};

export type AdminAttendanceLogItem = {
  id: number;
  userId?: number | null;
  userEmail?: string | null;
  userNickname?: string | null;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes: string[];
  workoutIntensity?: string | null;
  mediaUrls: string[];
  shared: boolean;
  shareSlug?: string | null;
  cheerCount: number;
  reportCount: number;
  hiddenByAdmin: boolean;
  editCount: number;
  lastEditedAt?: string | null;
  updatedAt?: string | null;
};

export type AnalyticsEventItem = {
  id: number;
  page: string;
  action: string;
  metadata?: string | null;
  userEmail?: string | null;
  userNickname?: string | null;
  createdAt: string;
};

export type AuditLogItem = {
  id: number;
  action: string;
  resource: string;
  summary?: string | null;
  metadata?: string | null;
  userEmail?: string | null;
  userNickname?: string | null;
  createdAt: string;
};

export type SupportInquiryItem = {
  id: number;
  name?: string | null;
  email?: string | null;
  message: string;
  page?: string | null;
  userId?: number | null;
  status: "OPEN" | "READ" | "IN_PROGRESS" | "RESOLVED";
  adminNote?: string | null;
  handledAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type AdminRole = "ROLE_ADMIN" | "ADMIN" | "ROLE_CONTENT_ADMIN" | "CONTENT_ADMIN" | "ROLE_SUPPORT_ADMIN" | "SUPPORT_ADMIN" | string;

export const adminQueryKeys = {
  ping: ["admin", "ping"] as const,
  summary: ["admin", "summary"] as const,
  applications: (page: number, size: number) => ["admin", "applications", page, size] as const,
  gallery: (page: number, size: number) => ["admin", "gallery", page, size] as const,
  proteins: (page: number, size: number) => ["admin", "proteins", page, size] as const,
  brags: (page: number, size: number) => ["admin", "brags", page, size] as const,
  attendanceShares: (page: number, size: number) => ["admin", "attendanceShares", page, size] as const,
  audit: (limit: number) => ["admin", "audit", limit] as const,
  me: ["admin", "me"] as const,
  health: ["admin", "health"] as const,
};

export const adminApi = {
  ping: () => api.get("/api/admin/ping").then((res) => res.status),

  getSummary: () =>
    api
      .get<SummaryResponse>("/api/admin/analytics/summary", { params: { days: 30 } })
      .then((res) => res.data),

  getAnalyticsEvents: (limit = 400) =>
    api.get<AnalyticsEventItem[]>("/api/admin/analytics/events", { params: { limit } }).then((res) => res.data),

  getApplications: (page = 0, size = 20) =>
    api
      .get<PagedResult<Application>>("/api/admin/programs/applications", { params: { page, size } })
      .then((res) => res.data),

  updateApplicationStatus: (id: number, status: Application["status"]) =>
    api.patch(`/api/admin/programs/applications/${id}/status`, null, { params: { status } }),

  getGallery: (page = 0, size = 20) =>
    api
      .get<PagedResult<string>>("/api/files/list/paged", { params: { folder: "gallery", page, size } })
      .then((res) => res.data),

  deleteGalleryItem: (url: string) =>
    api.delete("/api/files", { params: { path: url } }),

  getProteins: async (page = 0, size = 20): Promise<PagedResult<ProteinItem>> => {
    const res = await api.get("/api/proteins", { params: { page, size } });
    const data = res.data;
    const content = (data.content ?? []).map((p: any) => ({ id: p.id, name: p.name } as ProteinItem));
    return {
      content,
      number: data.number ?? page,
      totalPages: data.totalPages ?? 0,
      totalElements: data.totalElements ?? content.length,
      size: data.size ?? size,
    };
  },

  deleteProtein: (id: number) => api.delete(`/api/proteins/${id}`),

  getBrags: async (page = 0, size = 20): Promise<PagedResult<BragItem>> => {
    const res = await api.get("/api/brags", { params: { page, size } });
    const data = res.data;
    const content = (data.content ?? []).map((b: any) => ({ id: b.id, title: b.title } as BragItem));
    return {
      content,
      number: data.number ?? page,
      totalPages: data.totalPages ?? 0,
      totalElements: data.totalElements ?? content.length,
      size: data.size ?? size,
    };
  },

  deleteBrag: (id: number) => api.delete(`/api/admin/brags/${id}`),

  getAttendanceShares: (page = 0, size = 20) =>
    api
      .get<PagedResult<AttendanceShareItem>>("/api/admin/attendance/shares", { params: { page, size } })
      .then((res) => res.data),

  getAttendanceLogs: (params: {
    page?: number;
    size?: number;
    query?: string;
    didWorkout?: boolean | null;
    shared?: boolean | null;
    from?: string;
    to?: string;
  }) =>
    api
      .get<PagedResult<AdminAttendanceLogItem>>("/api/admin/attendance/logs", {
        params: {
          page: params.page ?? 0,
          size: params.size ?? 20,
          query: params.query?.trim() || undefined,
          didWorkout: params.didWorkout == null ? undefined : params.didWorkout,
          shared: params.shared == null ? undefined : params.shared,
          from: params.from || undefined,
          to: params.to || undefined,
        },
      })
      .then((res) => res.data),

  getSupportInquiries: (params: {
    page?: number;
    size?: number;
    query?: string;
    chairmanOnly?: boolean;
    status?: SupportInquiryItem["status"] | "all";
  }) =>
    api
      .get<PagedResult<SupportInquiryItem>>("/api/admin/support/inquiries", {
        params: {
          page: params.page ?? 0,
          size: params.size ?? 20,
          query: params.query?.trim() || undefined,
          chairmanOnly: params.chairmanOnly ?? false,
          status: !params.status || params.status === "all" ? undefined : params.status,
        },
      })
      .then((res) => res.data),

  updateSupportInquiryStatus: (id: number, payload: { status: SupportInquiryItem["status"]; adminNote?: string }) =>
    api.patch<SupportInquiryItem>(`/api/admin/support/inquiries/${id}/status`, payload).then((res) => res.data),

  setAttendanceHidden: (id: number, hidden: boolean) =>
    api.patch(`/api/admin/attendance/shares/${id}/hidden`, null, { params: { hidden } }),

  getAudit: (limit = 300) =>
    api.get<AuditLogItem[]>("/api/admin/audit", { params: { limit } }).then((res) => res.data),

  getMe: () => api.get<{ role?: AdminRole }>('/api/auth/me').then((res) => res.data),

  writeManualAudit: (payload: { action: string; resource: string; summary: string; metadata?: string }) =>
    api.post('/api/admin/audit/manual', payload),

  getHealthSummary: async () => {
    const [publicPing, adminPing, lobbyMetrics] = await Promise.allSettled([
      api.get('/ping'),
      api.get('/api/admin/ping'),
      api.get('/api/metrics/lobby'),
    ]);

    return {
      publicPingOk: publicPing.status === 'fulfilled',
      adminPingOk: adminPing.status === 'fulfilled',
      lobbyMetricsOk: lobbyMetrics.status === 'fulfilled',
    };
  },
};
