// 내가 추가한 운동(필라테스 · 수영 등) — 헬스 · 러닝과 달리 시간 + 메모만 기록한다(/api/activities).
// 진행 중 타이머는 이 기기(localStorage)에만 두고, 끝낼 때 운동한 시간만 서버에 보낸다.
import { api } from "./api";

export type ActivityCategory = "WEIGHT" | "CARDIO" | "STRETCH";

export type Activity = { id: number; name: string; category: ActivityCategory };

export type ActivityLogView = {
  id: number;
  activityId: number;
  name: string;
  date: string;
  startedAt: string;
  durationSec: number;
  note: string | null;
};

export type ActivityLogResult = {
  log: ActivityLogView;
  attendance: { created: boolean; expEarned: number | null; weeklyGoalBonus: number | null; rewardBox?: string | null };
};

/** 출석 종류(근력 · 유산소 · 스트레칭) — 서버 ActivityService.CATEGORIES */
export const CATEGORY_LABEL: Record<ActivityCategory, string> = { WEIGHT: "근력", CARDIO: "유산소", STRETCH: "스트레칭" };

/** 추가할 때 눌러서 채우는 예시 */
export const ACTIVITY_EXAMPLES: { name: string; category: ActivityCategory }[] = [
  { name: "필라테스", category: "STRETCH" },
  { name: "수영", category: "CARDIO" },
  { name: "요가", category: "STRETCH" },
  { name: "클라이밍", category: "WEIGHT" },
  { name: "자전거", category: "CARDIO" },
  { name: "복싱", category: "CARDIO" },
];

export const MAX_ACTIVITY_NAME = 20;
/** 서버가 받는 운동 시간 한도(1분 ~ 12시간) */
export const MAX_ACTIVITY_SEC = 12 * 3600;

export const fetchActivities = () => api.get<Activity[]>("/api/activities").then((r) => r.data);
export const addActivity = (name: string, category: ActivityCategory) =>
  api.post<Activity>("/api/activities", { name, category }).then((r) => r.data);
export const removeActivity = (id: number) => api.delete(`/api/activities/${id}`);
export const saveActivityLog = (id: number, body: { durationSec: number; endedAt?: string; note?: string | null; checkAttendance: boolean }) =>
  api.post<ActivityLogResult>(`/api/activities/${id}/logs`, body).then((r) => r.data);
export const fetchActivityLogs = (month?: string) =>
  api.get<ActivityLogView[]>("/api/activities/logs", { params: month ? { month } : undefined }).then((r) => r.data);
export const deleteActivityLog = (id: number) => api.delete(`/api/activities/logs/${id}`);

// ── 진행 중 타이머(이 기기에만)

export type ActiveActivity = { activityId: number; name: string; startedAt: number };

const KEY = "dg-activity-active-v1";

export function loadActiveActivity(): ActiveActivity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as ActiveActivity;
    // 하루가 지난 타이머는 서버가 받지 않는다 — 남겨 두면 헷갈려서 버린다
    if (!a || typeof a.startedAt !== "number" || Date.now() - a.startedAt > 24 * 3600 * 1000) return null;
    return a;
  } catch {
    return null;
  }
}

export function saveActiveActivity(a: ActiveActivity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // 저장소를 못 쓰면 화면을 닫기 전까지만 유지
  }
}

export function clearActiveActivity() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
