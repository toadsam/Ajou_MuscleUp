export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type FriendCharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export interface FriendCharacterSnapshot {
  tier: FriendCharacterTier;
  evolutionStage: number;
  level: number;
  avatarSeed: string | null;
}

export interface FriendRequestItem {
  id: number;
  requesterEmail: string;
  requesterNickname: string;
  requesterCharacter: FriendCharacterSnapshot | null;
  receiverEmail: string;
  receiverNickname: string;
  receiverCharacter: FriendCharacterSnapshot | null;
  status: FriendRequestStatus;
}

export interface FriendSummary {
  userId: number;
  email: string;
  nickname: string;
  character: FriendCharacterSnapshot | null;
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
