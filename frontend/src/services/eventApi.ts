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
};

export const eventApi = {
  getPublicList: (params: { status?: EventStatus; q?: string; page?: number; size?: number }) =>
    api.get<EventPageResponse<EventItem>>("/api/events", { params }).then((res) => res.data),

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
