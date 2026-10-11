export type CrewMemberRole = "LEADER" | "MEMBER";
export type CrewJoinPolicy = "AUTO_APPROVE" | "LEADER_APPROVE";
export type CrewCharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export interface CrewListItem {
  id: number;
  name: string;
  description?: string | null;
  ownerNickname: string;
  memberCount: number;
  joined: boolean;
  // 모임원이 아니면 서버가 null 을 준다(초대 코드는 모임원에게만 보인다).
  inviteCode: string | null;
  joinPolicy?: CrewJoinPolicy;
}

export interface CrewMemberAttendance {
  userId: number;
  nickname: string;
  role: CrewMemberRole;
  workoutDays: number;
  targetDays: number;
  attendanceRate: number;
  characterTier?: CrewCharacterTier | null;
  characterStage?: number | null;
  characterLevel?: number | null;
  avatarSeed?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
}

export interface CrewDetail {
  id: number;
  name: string;
  description?: string | null;
  ownerNickname: string;
  // 모임원이 아니면 서버가 null 을 준다(초대 코드는 모임원에게만 보인다).
  inviteCode: string | null;
  joinPolicy?: CrewJoinPolicy;
  joined: boolean;
  leader: boolean;
  month: string;
  targetDays: number;
  // 모임원이 아니면 false — 멤버별 출석 대신 아래 합계만 보여 준다.
  memberDetailVisible?: boolean;
  memberCount?: number;
  monthWorkoutTotal?: number;
  averageAttendanceRate?: number;
  members: CrewMemberAttendance[];
  challenges: CrewChallenge[];
  kingTitles: CrewKingTitle[];
  competitionBoard: CrewCompetitionEntry[];
}

export interface CrewChallengeMemberProgress {
  userId: number;
  nickname: string;
  workoutDays: number;
  targetWorkoutDays: number;
  completionRate: number;
  badge: string;
  characterTier?: CrewCharacterTier | null;
  characterStage?: number | null;
  characterLevel?: number | null;
  avatarSeed?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
}

export interface CrewChallenge {
  id: number;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ONGOING" | "ENDED";
  targetWorkoutDays: number;
  members: CrewChallengeMemberProgress[];
}

export interface CrewKingTitle {
  title: string;
  userId: number;
  nickname: string;
  metric: string;
}

export interface CrewCompetitionEntry {
  rank: number;
  userId: number;
  nickname: string;
  score: number;
  attendanceScore: number;
  challengeScore: number;
  recentScore: number;
  bonusScore: number;
  attendanceRate: number;
  recentWorkoutDays: number;
  challengeAverageCompletion: number;
}

export interface CrewJoinResult {
  crewId: number;
  crewName: string;
  inviteCode: string;
  result: "JOINED" | "PENDING" | "ALREADY_MEMBER";
  message: string;
}

export interface CrewJoinRequest {
  id: number;
  userId: number;
  nickname: string;
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
}
