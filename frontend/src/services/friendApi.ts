import { api } from "../lib/api";
import type { FriendChatMessage, FriendChatRoom, FriendRequestItem, FriendSummary } from "../types/friend";

export const friendApi = {
  sendRequest: (targetEmail: string) =>
    api.post<FriendRequestItem>("/api/friends/requests", { targetEmail }).then((res) => res.data),

  incoming: () =>
    api.get<FriendRequestItem[]>("/api/friends/requests/incoming").then((res) => res.data),

  outgoing: () =>
    api.get<FriendRequestItem[]>("/api/friends/requests/outgoing").then((res) => res.data),

  accept: (requestId: number) =>
    api.post<FriendRequestItem>(`/api/friends/requests/${requestId}/accept`).then((res) => res.data),

  reject: (requestId: number) =>
    api.post(`/api/friends/requests/${requestId}/reject`),

  list: () =>
    api.get<FriendSummary[]>("/api/friends").then((res) => res.data),

  remove: (friendId: number) =>
    api.delete(`/api/friends/${friendId}`),

  listRooms: () =>
    api.get<FriendChatRoom[]>("/api/friends/chat/rooms").then((res) => res.data),

  listMessages: (friendId: number, size = 50) =>
    api.get<FriendChatMessage[]>(`/api/friends/chat/rooms/${friendId}/messages`, { params: { size } }).then((res) => res.data),

  sendMessage: (friendId: number, content: string) =>
    api.post<FriendChatMessage>(`/api/friends/chat/rooms/${friendId}/messages`, { content }).then((res) => res.data),
};
