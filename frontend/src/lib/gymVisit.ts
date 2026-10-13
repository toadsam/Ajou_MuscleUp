// 친구 헬스장 구경 · 방명록 — 서버 /api/gym-decor/friends/{id}, /api/gym-decor/guestbook.
// 친구(서로 차단 안 함)만 볼 수 있다. 방명록은 한 줄 60자, 같은 헬스장에 하루 3개.
import { api } from "./api";
import type { DecorSlot, SceneId } from "../components/gymMap/decor";
import type { FriendCharacterSnapshot } from "../types/friend";

export const GUESTBOOK_MAX = 60;

export type GuestbookEntry = {
  id: number;
  authorId: number;
  nickname: string;
  message: string;
  createdAt: string;
  mine: boolean;
  canDelete: boolean;
};

export type FriendGym = {
  userId: number;
  nickname: string;
  character: FriendCharacterSnapshot | null;
  slots: { slot: DecorSlot; code: string | null }[];
  /** 친구가 연 공간(MAIN · FLOOR2 · TRACK · DINER) */
  spaces: SceneId[];
  guestbook: GuestbookEntry[];
};

export const fetchFriendGym = (userId: number) => api.get<FriendGym>(`/api/gym-decor/friends/${userId}`).then((res) => res.data);

export const writeGuestbook = (userId: number, message: string) =>
  api.post<GuestbookEntry>(`/api/gym-decor/friends/${userId}/guestbook`, { message }).then((res) => res.data);

export const fetchMyGuestbook = () => api.get<GuestbookEntry[]>("/api/gym-decor/guestbook").then((res) => res.data);

export const deleteGuestbook = (id: number) => api.delete(`/api/gym-decor/guestbook/${id}`);

// 내 방명록 "새 글" 표시: 이 기기에서 마지막으로 본 글 번호(편의용)
const SEEN_KEY = "dg.guestbook.seen";

export function readGuestbookSeen(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function writeGuestbookSeen(id: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    // 저장 못 해도 동작에는 상관없다
  }
}
