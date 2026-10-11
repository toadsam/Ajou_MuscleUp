// "짐(gym)" = 사람이 모이는 단위 하나. 동아리 · 운동 모임 · 헬스장 · PT 트레이너를 같은 모양으로 다룬다.
// 백엔드 /api/gyms 응답 모양과 화면에 쓰는 한국어 이름표.

export type GymType = "CLUB" | "CREW" | "GYM" | "PT";
export type GymVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type GymStatus = "PENDING" | "ACTIVE" | "ARCHIVED";
export type GymJoinPolicy = "AUTO_APPROVE" | "LEADER_APPROVE";
export type GymRole = "OWNER" | "STAFF" | "MEMBER";

export interface GymSummary {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  type: GymType;
  visibility: GymVisibility;
  status: GymStatus;
  schoolDomain: string | null;
  region: string | null;
  logoUrl: string | null;
  mapTheme: string | null;
  parentSlug: string | null;
  joinPolicy: GymJoinPolicy;
  features: string[];
  memberCount: number;
  joined: boolean;
  myRole: GymRole | null;
  /** 멤버에게만 내려온다 */
  inviteCode?: string | null;
}

export interface GymMember {
  userId: number;
  nickname: string;
  role: GymRole;
  title: string | null;
  joinedAt: string;
}

/** 크루 API 의 가입 신청 */
export interface GymJoinRequest {
  id: number;
  userId: number;
  nickname: string;
  email: string | null;
  status: string;
  requestedAt: string;
}

export interface GymJoinResult {
  result: string;
  message: string;
}

export const GYM_TYPE_LABEL: Record<GymType, string> = {
  CLUB: "동아리",
  CREW: "운동 모임",
  GYM: "헬스장",
  PT: "PT",
};

export const GYM_ROLE_LABEL: Record<GymRole, string> = {
  OWNER: "모임장",
  STAFF: "운영진",
  MEMBER: "멤버",
};

export const GYM_VISIBILITY_LABEL: Record<GymVisibility, string> = {
  PUBLIC: "공개",
  UNLISTED: "링크로만",
  PRIVATE: "비공개",
};

export const GYM_STATUS_LABEL: Record<GymStatus, string> = {
  PENDING: "승인 대기",
  ACTIVE: "운영 중",
  ARCHIVED: "보관됨",
};

export const GYM_JOIN_POLICY_LABEL: Record<GymJoinPolicy, string> = {
  AUTO_APPROVE: "바로 가입",
  LEADER_APPROVE: "승인 후 가입",
};

export const GYM_TYPES: GymType[] = ["CLUB", "CREW", "GYM", "PT"];

/** 서버와 같은 주소 규칙: 소문자 · 숫자 · 하이픈, 3~40자, 하이픈으로 시작/끝나지 않음 */
export const GYM_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** 종류별 칩 색(원판 색은 의미가 있을 때만: 동아리=빨강 대표, 모임=파랑, 헬스장=초록, PT=노랑) */
export const GYM_TYPE_CHIP: Record<GymType, string> = {
  CLUB: "bg-plate-red text-white",
  CREW: "bg-plate-blue text-white",
  GYM: "bg-plate-green text-white",
  PT: "bg-plate-yellow text-black",
};

export const GYM_STATUS_CHIP: Record<GymStatus, string> = {
  PENDING: "bg-plate-yellow text-black",
  ACTIVE: "bg-plate-green text-white",
  ARCHIVED: "bg-steel-700 text-steel-300",
};
