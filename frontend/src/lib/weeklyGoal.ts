// 주간 목표 연속 기록(PR D) — 서버 WeeklyGoalService.Status 와 같은 모양
export type WeeklyGoalStatus = {
  weekStart: string;
  weekEnd: string;
  /** 이번 주에 적용된 목표 */
  target: number;
  /** 지금 설정(이번 주에 운동했으면 다음 주부터 적용) */
  nextTarget: number;
  done: number;
  /** 월~일 운동 여부 */
  days: boolean[];
  achieved: boolean;
  rest: boolean;
  canRest: boolean;
  streakWeeks: number;
  /** 이번 주를 달성하면(했으면) 받는 보너스 */
  bonusPoints: number;
  rewarded: boolean;
};

export const WEEKLY_GOAL_PATH = "/api/attendance/weekly-goal";
export const WEEKLY_GOAL_MAX = 7;
