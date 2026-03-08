export type CrewMemberRole = "LEADER" | "MEMBER";

export interface CrewListItem {
  id: number;
  name: string;
  description?: string | null;
  ownerNickname: string;
  memberCount: number;
  joined: boolean;
  inviteCode: string;
}

export interface CrewMemberAttendance {
  userId: number;
  nickname: string;
  role: CrewMemberRole;
  workoutDays: number;
  targetDays: number;
  attendanceRate: number;
}

export interface CrewDetail {
  id: number;
  name: string;
  description?: string | null;
  ownerNickname: string;
  inviteCode: string;
  joined: boolean;
  leader: boolean;
  month: string;
  targetDays: number;
  members: CrewMemberAttendance[];
  challenges: CrewChallenge[];
}

export interface CrewChallengeMemberProgress {
  userId: number;
  nickname: string;
  workoutDays: number;
  targetWorkoutDays: number;
  completionRate: number;
  badge: string;
}

export interface CrewChallenge {
  id: number;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  targetWorkoutDays: number;
  members: CrewChallengeMemberProgress[];
}
