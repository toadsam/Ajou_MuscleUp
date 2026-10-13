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
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
  /** 도감에서 장착한 민소매 색 · 칭호, 운동 직후 펌핑 */
  tank?: string | null;
  title?: string | null;
  isPumped?: boolean;
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
