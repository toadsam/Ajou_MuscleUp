// 주간 보스 "그림자"(docs/design/shadow-boss.md) — 서버 dto/shadow/* 와 같은 모양.
// 그림자 = 지난 4주의 나. 이번 주 운동 세션 · 러닝이 공격, 자기 기록 갱신이 치명타, 처치하면 점수 · 상자 · 칭호.

export type ShadowSource = "SESSION" | "RUN";

export type ShadowReward = { points: number; box: number; titles: string[] };

/** 공격 한 번(운동 · 러닝 저장 응답의 shadow, 상태의 hits) */
export type ShadowHit = {
  id: number;
  source: ShadowSource;
  /** 공격한 날(YYYY-MM-DD) */
  hitOn: string;
  /** 이번 주 그림자 체력(바의 전체 길이) */
  hp: number;
  /** 환산한 힘(상한 · 치명타 전) */
  raw: number;
  /** 실제 들어간 힘. 하루 상한에 걸리면 0 */
  damage: number;
  crit: boolean;
  hpBefore: number;
  hpAfter: number;
  /** 이 공격으로 처치했는지 — 처치 연출은 이때만 */
  killed: boolean;
  overkillPct: number;
  reward: ShadowReward | null;
};

export type ShadowStatus = {
  name: string;
  weekStart: string;
  weekEnd: string;
  rest: boolean;
  hp: number;
  damage: number;
  remaining: number;
  killed: boolean;
  killedAt: string | null;
  overkillPct: number;
  level: number;
  hits: ShadowHit[];
  streakWeeks: number;
  lastWeek: { hp: number; damage: number; killed: boolean; rest: boolean } | null;
};

export type ShadowHistoryItem = { weekStart: string; hp: number; damage: number; killed: boolean; rest: boolean };

export const SHADOW_PATH = "/api/shadow";
export const SHADOW_HISTORY_PATH = "/api/shadow/history?weeks=8";
/** 서버 ShadowRules 와 같은 숫자 — 화면 설명용 */
export const SHADOW_DAILY_CAP = 300;

export const SOURCE_LABEL: Record<ShadowSource, string> = { SESSION: "운동", RUN: "러닝" };

const DAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "10/14 (화)" */
export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY[d.getDay()]})`;
}

/** 홈 카드 한 줄 문구 */
export function shadowOneLiner(s: ShadowStatus) {
  if (s.rest) return "쉬는 중";
  if (s.killed) return s.overkillPct > 0 ? `처치! 오버킬 ${s.overkillPct}%` : "처치!";
  return `${s.remaining.toLocaleString()} 남음`;
}

/** 월요일(weekStart) 기준으로 최근 n 주의 월요일 목록(이번 주 먼저) */
export function recentWeekStarts(thisWeekStart: string, n: number) {
  const base = new Date(`${thisWeekStart}T00:00:00`);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i * 7);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${d.getFullYear()}-${m}-${day}`);
  }
  return out;
}
