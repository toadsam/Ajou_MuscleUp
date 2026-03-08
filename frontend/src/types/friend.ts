export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface FriendRequestItem {
  id: number;
  requesterEmail: string;
  requesterNickname: string;
  receiverEmail: string;
  receiverNickname: string;
  status: FriendRequestStatus;
}

export interface FriendSummary {
  userId: number;
  email: string;
  nickname: string;
}

export interface FriendChatRoom {
  roomId: number;
  friendId: number;
  friendNickname: string;
}

export interface FriendChatMessage {
  id: number;
  senderId: number;
  senderNickname: string;
  content: string;
  createdAt: string;
}
