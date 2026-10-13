// 운동 세션(번핏처럼) — 진행 중 상태는 이 기기에만(localStorage) 두고, 끝낼 때 서버에 한 번 저장한다.
// 새로고침 · 화면 꺼짐 · 다른 화면에 다녀와도 이어서 할 수 있게 바뀔 때마다 저장한다.
import type { LiftPr, LiftStatUpdate } from "./lifts";

export type ActiveSet = { weight: string; reps: string; done: boolean };

export type PreviousSets = { date: string; sets: { weightKg: number; reps: number }[] };

export type ActiveExercise = { code: string; sets: ActiveSet[]; previous: PreviousSets | null };

export type ActiveSession = {
  /** 시작 시각(ms) */
  startedAt: number;
  exercises: ActiveExercise[];
  /** 휴식 타이머: 끝나는 시각(ms) · 전체 길이(초) */
  rest: { endsAt: number; seconds: number } | null;
  /** 세트를 끝내면 시작하는 휴식 길이(초) */
  restSeconds: number;
  /** 마지막으로 세트를 체크한 시각(ms) — 끝내기를 잊었을 때 실제 끝난 시각을 짐작하는 데 쓴다 */
  lastDoneAt?: number;
};

export type SessionSummary = {
  id: number;
  date: string;
  startedAt: string;
  durationSec: number;
  totalVolume: number;
  totalSets: number;
  exercises: string[];
};

export type SessionDetail = {
  summary: SessionSummary;
  exercises: { exercise: string; label: string; bodyweight: boolean; sets: { weightKg: number; reps: number }[]; volume: number }[];
  note: string | null;
};

export type SessionSaveResult = {
  session: SessionDetail;
  prs: LiftPr[];
  statUpdates: LiftStatUpdate[];
  points: number;
  attendance: { created: boolean; expEarned: number | null; weeklyGoalBonus: number | null; rewardBox?: string | null };
};

const KEY = "dg-workout-session-v1";
export const REST_CHOICES = [60, 90, 120, 180];

export function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    // 하루가 지난 세션은 서버가 받지 않는다(6시간 넘음) — 남겨 두면 헷갈려서 버린다
    if (!s || typeof s.startedAt !== "number" || Date.now() - s.startedAt > 24 * 3600 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: ActiveSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드) 화면을 닫기 전까지만 유지
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function newSession(): ActiveSession {
  return { startedAt: Date.now(), exercises: [], rest: null, restSeconds: 90 };
}

/** 52:07 · 1:05:30 */
export function formatClock(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "52분" · "1시간 5분" */
/** 서버가 받는 운동 시간 한도(WorkoutSessionService.MAX_DURATION 과 같게) */
export const MAX_SESSION_SEC = 6 * 3600;

/**
 * 끝내기를 잊어 한도를 넘긴 세션에서 고를 수 있는 "실제 운동 시간"(초).
 * 마지막 세트를 체크한 시각이 있으면 그때 + 3분을 맨 앞(기본)으로.
 */
export function longSessionChoices(s: ActiveSession): { sec: number; label: string }[] {
  const out: { sec: number; label: string }[] = [];
  if (s.lastDoneAt && s.lastDoneAt > s.startedAt) {
    const sec = Math.min(MAX_SESSION_SEC, Math.max(60, Math.round((s.lastDoneAt - s.startedAt) / 1000) + 180));
    out.push({ sec, label: `마지막 세트까지 · ${formatDuration(sec)}` });
  }
  for (const min of [30, 60, 90, 120]) {
    if (!out.some((c) => c.sec === min * 60)) out.push({ sec: min * 60, label: formatDuration(min * 60) });
  }
  return out;
}

export function formatDuration(totalSec: number) {
  const min = Math.max(1, Math.round(totalSec / 60));
  const h = Math.floor(min / 60);
  return h ? `${h}시간${min % 60 ? ` ${min % 60}분` : ""}` : `${min}분`;
}

export function doneSetCount(s: ActiveSession) {
  return s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
}

export function doneVolume(s: ActiveSession) {
  return s.exercises.reduce(
    (v, e) => v + e.sets.filter((x) => x.done).reduce((a, x) => a + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0),
    0,
  );
}
