// 주간 보스 "그림자"(docs/design/shadow-boss.md) + 던전(docs/design/shadow-dungeon.md) — 서버 dto/shadow/* 와 같은 모양.
// 그림자 = 지난 4주의 나. 2차부터 운동 · 러닝 저장은 "힘 모으기"(통 5개), 던전에서 기술로 쏜다. 자기 기록 갱신은 치명타 토큰, 처치하면 점수 · 상자 · 칭호.

import type { ActionKind, Equip } from "../components/avatar/pixelAvatar";

/** 1차 SESSION · RUN(저장이 곧 공격이던 때), 2차 DUNGEON(던전 타) · SETTLE(주 끝 자동 정산), 지도판 MOB(잡몹 타 — 응답에만) */
export type ShadowSource = "SESSION" | "RUN" | "DUNGEON" | "SETTLE" | "MOB";

/** 기술 = 통(종목 category). 순서 = 화면 원판 순서 */
export type ShadowSkill = "LEGS" | "CHEST" | "BACK" | "ARMS" | "RUN";
export const SKILLS: ShadowSkill[] = ["LEGS", "CHEST", "BACK", "ARMS", "RUN"];

export type ShadowGrade = "PERFECT" | "GOOD" | "MISS";

export type ShadowReward = { points: number; box: number; titles: string[] };

/** 공격 한 번(던전 strike 응답, 상태의 hits) */
export type ShadowHit = {
  id: number;
  source: ShadowSource;
  /** 공격한 날(YYYY-MM-DD) */
  hitOn: string;
  /** 이번 주 그림자 체력(바의 전체 길이) */
  hp: number;
  /** 통에서 쓴 힘(보너스 · 치명타 전) */
  raw: number;
  /** 실제 들어간 힘 */
  damage: number;
  crit: boolean;
  hpBefore: number;
  hpAfter: number;
  /** 이 공격으로 처치했는지 — 처치 연출은 이때만 */
  killed: boolean;
  overkillPct: number;
  reward: ShadowReward | null;
  /** 2차: 기술 · 등급 · 보너스 · 연출용 타 분배(합 = damage). 1차 공격 · 정산은 skill · grade 가 null */
  skill: ShadowSkill | null;
  grade: ShadowGrade | null;
  bonus: number;
  shares: number[];
  /** strike 응답에만: 이 타 뒤 남은 통 · 토큰 */
  chargeLeft: Record<ShadowSkill, number> | null;
  critTokensLeft: number | null;
  /** 지도판: 잡몹을 친 타면 그 결과(hp · hpBefore · hpAfter · killed 도 잡몹 것). 보스 타는 null */
  mob: ShadowMobHit | null;
};

/** 잡몹을 친 결과: 통으로 돌려준 힘 · 받은 조각 · 종류별 첫 처치(도감 카드) */
export type ShadowMobHit = { id: number; code: string; name: string; rare: boolean; refunded: number; shards: number; firstKill: boolean };

/** 이번 주 잡몹 한 마리(slot = 맵 자리 번호) */
export type ShadowMob = { id: number; code: string; name: string; slot: number; hp: number; remaining: number; killed: boolean; rare: boolean; shards: number };

export type ShadowStats = { strengthKg: number; enduranceKm: number; attendanceStreak: number; weeklyStreak: number; level: number };

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
  /** 2차: 통별 안 쓴 힘 · 합 · 치명타 토큰 · 켜진 패시브 · 능력치 */
  charge: Record<ShadowSkill, number>;
  chargeTotal: number;
  critTokens: number;
  passives: string[];
  stats: ShadowStats;
  /** 지도판: 이번 주 잡몹(자리 순) */
  mobs: ShadowMob[];
};

/** 운동 · 러닝 저장 응답의 shadowCharge — 이 저장으로 모인 힘 */
export type ShadowCharge = {
  charged: Partial<Record<ShadowSkill, number>>;
  total: number;
  critToken: boolean;
  capped: boolean;
  chargeLeft: Record<ShadowSkill, number>;
  chargeTotal: number;
  critTokens: number;
  hp: number;
  remaining: number;
  killed: boolean;
};

export type ShadowHistoryItem = { weekStart: string; hp: number; damage: number; killed: boolean; rest: boolean };

export const SHADOW_PATH = "/api/shadow";
export const SHADOW_HISTORY_PATH = "/api/shadow/history?weeks=8";
export const SHADOW_ENTER_PATH = "/api/shadow/dungeon/enter";
export const SHADOW_STRIKE_PATH = "/api/shadow/dungeon/strike";
export const DUNGEON_PATH = "/shadow/dungeon";

/** 서버 ShadowRules 와 같은 숫자 — 화면 설명 · 개발 화면의 흉내 계산용 */
export const SHADOW_DAILY_CAP = 300;
export const STRIKE_CHUNK = 60;
/** 지도판에서 낮춤(조작 영향 "거의 없게") — 서버 ShadowRules.TIMING_* */
export const TIMING_PCT: Record<ShadowGrade, number> = { PERFECT: 5, GOOD: 2, MISS: 0 };
export const PASSIVE_PCT = 5;
export const PASSIVE_CAP_PCT = 15;
export const PASSIVES = { BIG_THREE: "삼대장", LONG_RUN: "장거리", STEADY: "꾸준함", HUNTER: "그림자 사냥꾼" } as const;

export const SOURCE_LABEL: Record<ShadowSource, string> = { SESSION: "운동", RUN: "러닝", DUNGEON: "던전", SETTLE: "자동", MOB: "잡몹" };

/** 기술 하나의 화면 정보: 이름 · 채우는 운동 · 원판 색(국제 규격 — 의미: 통 구분) · 내 동작 · 연출 종류 */
export type SkillMeta = {
  code: ShadowSkill;
  label: string;
  pool: string;
  /** 원판 색 토큰 */
  color: string;
  ink: string;
  kind: ActionKind;
  equip: Equip;
  /** 연출: quake 점프 착지 · push 큰 넉백 · lift 들어 찍기 · jab 연타 · dash 관통 */
  fx: "quake" | "push" | "lift" | "jab" | "dash";
  hint: string;
};

export const SKILL_META: Record<ShadowSkill, SkillMeta> = {
  LEGS: { code: "LEGS", label: "지진", pool: "하체", color: "#D9302A", ink: "#F4F2EC", kind: "squat", equip: "barbell", fx: "quake", hint: "스쿼트 · 레그프레스 · 런지" },
  CHEST: { code: "CHEST", label: "밀어내기", pool: "가슴", color: "#2F6FD0", ink: "#F4F2EC", kind: "bench", equip: "barbell", fx: "push", hint: "벤치 · 플라이 · 푸시업" },
  BACK: { code: "BACK", label: "들어 던지기", pool: "등", color: "#F0BE2E", ink: "#0E0E10", kind: "deadlift", equip: "barbell", fx: "lift", hint: "데드리프트 · 로우 · 턱걸이" },
  ARMS: { code: "ARMS", label: "연타", pool: "어깨 · 팔 · 코어", color: "#2E9C55", ink: "#F4F2EC", kind: "press", equip: "dumbbell", fx: "jab", hint: "프레스 · 컬 · 크런치" },
  RUN: { code: "RUN", label: "돌진", pool: "러닝", color: "#EEECE6", ink: "#0E0E10", kind: "run", equip: "none", fx: "dash", hint: "러닝 100m = 1" },
};

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

/** 타이밍 게이지 위치(0~1, 가운데 0.5) → 등급. 가운데 ±6% PERFECT · ±15% GOOD */
export function gradeOf(position: number): ShadowGrade {
  const off = Math.abs(position - 0.5);
  if (off <= 0.06) return "PERFECT";
  if (off <= 0.15) return "GOOD";
  return "MISS";
}

/** 통이 전부 비었나 */
export function allEmpty(charge: Record<ShadowSkill, number>) {
  return SKILLS.every((s) => (charge[s] ?? 0) <= 0);
}

// ---- 서버 ShadowRules 를 흉내 내는 로컬 계산(개발 화면 /dev/dungeon 전용 — 실제 화면은 서버 응답만 믿는다) ----

export function localPassivePct(skill: ShadowSkill, passives: string[]) {
  let pct = 0;
  if (passives.includes(PASSIVES.BIG_THREE) && (skill === "LEGS" || skill === "CHEST" || skill === "BACK")) pct += PASSIVE_PCT;
  if (passives.includes(PASSIVES.LONG_RUN) && skill === "RUN") pct += PASSIVE_PCT;
  if (passives.includes(PASSIVES.STEADY)) pct += PASSIVE_PCT;
  return Math.min(pct, PASSIVE_CAP_PCT);
}

/** 연출용 타 분배(서버 shares 와 같은 규칙) */
export function localShares(skill: ShadowSkill, damage: number, passives: string[]) {
  if (damage <= 0) return [0];
  const split = (n: number) => {
    const count = Math.max(1, Math.min(n, damage));
    const base = Math.floor(damage / count);
    const rest = damage - base * count;
    return Array.from({ length: count }, (_, i) => base + (i >= count - rest ? 1 : 0));
  };
  if (skill === "BACK") {
    const first = Math.round(damage * 0.3);
    return [first, damage - first];
  }
  if (skill === "ARMS") return split(4);
  if (skill === "RUN" && passives.includes(PASSIVES.LONG_RUN)) return split(2);
  return [damage];
}

export type LocalWorld = {
  hp: number;
  damage: number;
  level: number;
  charge: Record<ShadowSkill, number>;
  critTokens: number;
  passives: string[];
  killed: boolean;
  rewarded: boolean;
  nextId: number;
  /** 지도판 잡몹 */
  mobs: ShadowMob[];
};

const localDamage = (force: number, bonusPct: number, crit: boolean, mult: number) => {
  const boosted = Math.round((force * (100 + bonusPct)) / 100);
  return crit ? Math.round(boosted * mult) : boosted;
};

/** 개발 화면용 한 타: 서버 strike 와 같은 셈. 통이 비면 null. target 이 잡몹 id 면 그 잡몹(남는 힘은 통으로) */
export function localStrike(w: LocalWorld, skill: ShadowSkill, grade: ShadowGrade, useCrit: boolean, target: "BOSS" | number = "BOSS"): { hit: ShadowHit; world: LocalWorld } | null {
  const pool = w.charge[skill] ?? 0;
  if (pool <= 0) return null;
  const force = Math.min(pool, STRIKE_CHUNK);
  const crit = useCrit && w.critTokens > 0;
  const bonusPct = TIMING_PCT[grade] + localPassivePct(skill, w.passives);
  const mult = 1.5 + w.level * 0.01 + (w.passives.includes(PASSIVES.HUNTER) ? 0.1 : 0);
  if (target !== "BOSS") {
    const mob = w.mobs.find((m) => m.id === target);
    if (!mob || mob.killed) return null;
    const before = mob.remaining;
    let used = force;
    for (let f = 1; f <= force; f += 1) {
      if (localDamage(f, bonusPct, crit, mult) >= before) {
        used = f;
        break;
      }
    }
    const dealt = Math.min(before, localDamage(used, bonusPct, crit, mult));
    const after = before - dealt;
    const killedNow = after === 0;
    const firstKill = killedNow && !w.mobs.some((m) => m.code === mob.code && m.killed);
    const charge = { ...w.charge, [skill]: pool - used };
    const world: LocalWorld = {
      ...w,
      charge,
      critTokens: crit ? w.critTokens - 1 : w.critTokens,
      mobs: w.mobs.map((m) => (m.id === mob.id ? { ...m, remaining: after, killed: killedNow } : m)),
      nextId: w.nextId + 1,
    };
    const hit: ShadowHit = {
      id: mob.id,
      source: "MOB",
      hitOn: new Date().toISOString().slice(0, 10),
      hp: mob.hp,
      raw: used,
      damage: dealt,
      crit,
      hpBefore: before,
      hpAfter: after,
      killed: killedNow,
      overkillPct: 0,
      reward: null,
      skill,
      grade,
      bonus: Math.min(dealt, Math.round((used * (100 + bonusPct)) / 100) - used),
      shares: localShares(skill, dealt, w.passives),
      chargeLeft: charge,
      critTokensLeft: world.critTokens,
      mob: { id: mob.id, code: mob.code, name: mob.name, rare: mob.rare, refunded: force - used, shards: killedNow ? mob.shards : 0, firstKill },
    };
    return { hit, world };
  }
  const raw = force;
  const boosted = Math.round((raw * (100 + bonusPct)) / 100);
  const damage = localDamage(raw, bonusPct, crit, mult);
  const before = Math.max(0, w.hp - w.damage);
  const total = w.damage + damage;
  const after = Math.max(0, w.hp - total);
  const killedNow = !w.killed && total >= w.hp;
  const charge = { ...w.charge, [skill]: pool - raw };
  const world: LocalWorld = {
    ...w,
    damage: total,
    charge,
    critTokens: crit ? w.critTokens - 1 : w.critTokens,
    killed: w.killed || killedNow,
    rewarded: w.rewarded || killedNow,
    nextId: w.nextId + 1,
  };
  const hit: ShadowHit = {
    id: w.nextId,
    source: "DUNGEON",
    hitOn: new Date().toISOString().slice(0, 10),
    hp: w.hp,
    raw,
    damage,
    crit,
    hpBefore: before,
    hpAfter: after,
    killed: killedNow,
    overkillPct: total > w.hp ? Math.round(((total - w.hp) * 100) / w.hp) : 0,
    reward: killedNow && !w.rewarded ? { points: 10, box: 1, titles: ["그림자를 넘은 자"] } : null,
    skill,
    grade,
    bonus: boosted - raw,
    shares: localShares(skill, damage, w.passives),
    chargeLeft: charge,
    critTokensLeft: world.critTokens,
    mob: null,
  };
  return { hit, world };
}
