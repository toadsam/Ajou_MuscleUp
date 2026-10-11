import { api } from "../lib/api";
import type { EventDetail, EventItem, EventPageResponse, EventStatus } from "../types/event";

type EventSavePayload = {
  title: string;
  summary: string;
  content: string;
  thumbnailUrl: string;
  bannerUrl?: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  isMainBanner: boolean;
  isPinned: boolean;
  priority: number;
  ctaText: string;
  ctaLink: string;
  tags: string[];
  /** 비우면 앱 전체 공지 */
  gymSlug?: string;
};

export const eventApi = {
  // gym 이 없으면 광장(앱 전체 공지 + 공개 모임 소식), 있으면 그 모임 소식 + 앱 전체 공지
  getPublicList: (params: { gym?: string | null; status?: EventStatus; q?: string; page?: number; size?: number }) =>
    api
      .get<EventPageResponse<EventItem>>("/api/events", {
        params: { ...params, gym: params.gym || undefined },
      })
      .then((res) => res.data),

  getPublicDetail: (id: number) =>
    api.get<EventDetail>(`/api/events/${id}`).then((res) => res.data),

  increaseView: (id: number) => api.post(`/api/events/${id}/view`),
  increaseClick: (id: number) => api.post(`/api/events/${id}/click`),

  getAdminList: (params: { status?: EventStatus; q?: string; page?: number; size?: number }) =>
    api.get<EventPageResponse<EventItem>>("/api/admin/events", { params }).then((res) => res.data),

  getAdminDetail: (id: number) =>
    api.get<EventDetail>(`/api/admin/events/${id}`).then((res) => res.data),

  create: (payload: EventSavePayload) =>
    api.post<EventDetail>("/api/admin/events", payload).then((res) => res.data),

  update: (id: number, payload: EventSavePayload) =>
    api.put<EventDetail>(`/api/admin/events/${id}`, payload).then((res) => res.data),

  remove: (id: number) => api.delete(`/api/admin/events/${id}`),

  patchStatus: (id: number, status: EventStatus) =>
    api.patch(`/api/admin/events/${id}/status`, { status }),

  patchMainBanner: (id: number, value: boolean) =>
    api.patch(`/api/admin/events/${id}/main-banner`, { value }),

  patchPin: (id: number, value: boolean) =>
    api.patch(`/api/admin/events/${id}/pin`, { value }),
};

// 이벤트 상태 코드를 화면용 한국어로. 목록(Events)과 상세(EventDetail)가 같이 쓴다.
// ONGOING 은 예전 서버 값이 섞여 올 때를 대비한 별칭.
export const eventStatusLabel = (status?: EventStatus | string | null): string => {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
    case "ONGOING":
      return "진행 중";
    case "SCHEDULED":
      return "예정";
    case "ENDED":
      return "종료";
    case "DRAFT":
      return "준비 중";
    case "HIDDEN":
      return "숨김";
    default:
      return "이벤트";
  }
};
