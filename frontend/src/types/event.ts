export type EventStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ENDED" | "HIDDEN";

export interface EventItem {
  id: number;
  title: string;
  summary: string;
  thumbnailUrl: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  isMainBanner: boolean;
  isPinned: boolean;
  priority: number;
  viewCount: number;
  updatedAt?: string;
  /** 모임 소식이면 그 모임 주소 · 이름. 앱 전체 공지면 null */
  gymSlug?: string | null;
  gymName?: string | null;
}

export interface EventDetail extends EventItem {
  content: string;
  bannerUrl?: string | null;
  ctaText: string;
  ctaLink: string;
  tags: string[];
  clickCount: number;
  updatedAt: string;
}

export interface EventPageResponse<T> {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
  size: number;
}
