import { api } from "../lib/api";
import type {
  FriendCharacterSnapshot,
  FriendChatMessage,
  FriendChatRoom,
  FriendRequestItem,
  FriendSummary,
} from "../types/friend";

// 2026-10-11: 친구 API 응답에서 이메일을 뺐다(닉네임 검색으로 찾은 상대의 이메일이 보이지 않게).
// types/friend.ts 의 옛 필드(requesterEmail/receiverEmail/email) 대신 아래 타입을 쓴다.
export type FriendRequestView = Omit<FriendRequestItem, "requesterEmail" | "receiverEmail"> & {
  requesterId: number;
  receiverId: number;
};

export type FriendSummaryView = Omit<FriendSummary, "email">;

export type FriendRelation = "FRIEND" | "OUTGOING" | "INCOMING" | "NONE";

export interface FriendSearchResult {
  userId: number;
  nickname: string;
  character: FriendCharacterSnapshot | null;
  relation: FriendRelation;
}

export const friendApi = {
  /** 닉네임 앞부분으로 찾기(2자 이상, 최대 10명, 나 제외) */
  search: (query: string) =>
    api.get<FriendSearchResult[]>("/api/friends/search", { params: { q: query } }).then((res) => res.data),

  sendRequestToUser: (targetUserId: number) =>
    api.post<FriendRequestView>("/api/friends/requests", { targetUserId }).then((res) => res.data),

  sendRequest: (targetEmail: string) =>
    api.post<FriendRequestView>("/api/friends/requests", { targetEmail }).then((res) => res.data),

  incoming: () =>
    api.get<FriendRequestView[]>("/api/friends/requests/incoming").then((res) => res.data),

  outgoing: () =>
    api.get<FriendRequestView[]>("/api/friends/requests/outgoing").then((res) => res.data),

  accept: (requestId: number) =>
    api.post<FriendRequestView>(`/api/friends/requests/${requestId}/accept`).then((res) => res.data),

  reject: (requestId: number) =>
    api.post(`/api/friends/requests/${requestId}/reject`),

  list: () =>
    api.get<FriendSummaryView[]>("/api/friends").then((res) => res.data),

  remove: (friendId: number) =>
    api.delete(`/api/friends/${friendId}`),

  listRooms: () =>
    api.get<FriendChatRoom[]>("/api/friends/chat/rooms").then((res) => res.data),

  listMessages: (friendId: number, size = 50) =>
    api.get<FriendChatMessage[]>(`/api/friends/chat/rooms/${friendId}/messages`, { params: { size } }).then((res) => res.data),

  sendMessage: (friendId: number, content: string) =>
    api.post<FriendChatMessage>(`/api/friends/chat/rooms/${friendId}/messages`, { content }).then((res) => res.data),
};
