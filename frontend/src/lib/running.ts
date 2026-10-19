// 러닝(나이키 런클럽처럼) — GPS 로 거리 · 시간 · 1km 구간을 잰다.
// 진행 중 상태는 이 기기(localStorage)에만 두고, 끝낼 때 거리 · 시간 · 구간만 서버에 보낸다.
// 지나간 경로(위치)는 서버로 보내지 않는다 — 이 기기에만 최근 30번까지 남긴다(사용자 결정).

import type { ShadowCharge } from "./shadow";

export type LatLng = [number, number];

export type ActiveRun = {
  /** 시작 시각(ms) */
  startedAt: number;
  /** 멈춘 시각(ms) — 멈춘 동안은 거리 · 시간을 세지 않는다 */
  pausedAt: number | null;
  /** 지금까지 멈춰 있던 시간(ms) */
  pausedMs: number;
  distanceM: number;
  /** 마지막으로 받아들인 위치 · 그때의 달린 시간(초) */
  last: { lat: number; lng: number; moving: number } | null;
  /** 연달아 버린 위치 수(튀는 값이 이어지면 거기서 다시 시작) */
  rejected: number;
  /** 1km 마다 걸린 초 */
  splits: number[];
  /** 마지막 구간이 끝난 달린 시간(초) */
  lastSplitAt: number;
  /** 현재 페이스 계산용 최근 기록(달린 시간 · 거리) */
  recent: { moving: number; d: number }[];
  route: LatLng[];
  /** 마지막 위치의 정확도(m) */
  accuracy: number | null;
};

export type RunView = {
  id: number;
  date: string;
  startedAt: string;
  durationSec: number;
  distanceM: number;
  paceSec: number | null;
  splits: number[];
  source: "GPS" | "MANUAL";
  best1kSec: number | null;
  best5kSec: number | null;
  best10kSec: number | null;
  note: string | null;
};

export type RunRecord = { type: "DISTANCE" | "K1" | "K5" | "K10"; label: string; previous: number | null; value: number };

export type RunSaveResult = {
  run: RunView;
  records: RunRecord[];
  points: number;
  attendance: { created: boolean; expEarned: number | null; weeklyGoalBonus: number | null; rewardBox?: string | null };
  /** 이 러닝이 주간 보스 그림자에게 한 공격(힘 1 미만이면 null) */
  /** 이 러닝으로 그림자 던전에 모인 힘(힘 1 미만이면 null) */
  shadowCharge: ShadowCharge | null;
};

export type RunRecords = {
  longestM: number | null;
  best1kSec: number | null;
  best5kSec: number | null;
  best10kSec: number | null;
  weekDistanceM: number;
  weekRuns: number;
  monthDistanceM: number;
  monthRuns: number;
  totalDistanceM: number;
};

const KEY = "dg-run-active-v1";
const ROUTES_KEY = "dg-run-routes-v1";
const MAX_ROUTES = 30;
const MAX_ROUTE_POINTS = 4000;

/** 이보다 부정확한 위치는 버린다(m) */
export const GOOD_ACCURACY = 35;
/** 한 번에 이보다 빠르게 움직였으면 튄 값(m/s, 1km 2분 23초) */
const MAX_SPEED = 7;
/** 이보다 작게 움직이면 제자리 떨림으로 보고 기다린다(m) */
const MIN_STEP = 4;
/** 서버와 같은 한도: 1km 2분 30초보다 빠른 구간은 없다 */
export const MIN_PACE_SEC = 150;

export function newRun(now = Date.now()): ActiveRun {
  return {
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    distanceM: 0,
    last: null,
    rejected: 0,
    splits: [],
    lastSplitAt: 0,
    recent: [],
    route: [],
    accuracy: null,
  };
}

/** 멈춘 시간을 뺀 달린 시간(초) */
export function movingSec(run: ActiveRun, now = Date.now()) {
  const end = run.pausedAt ?? now;
  return Math.max(0, (end - run.startedAt - run.pausedMs) / 1000);
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Fix = { lat: number; lng: number; accuracy: number; time: number };

/** 새 위치 하나를 반영한 러닝(그대로 두어야 하면 같은 객체의 얕은 복사) */
export function applyFix(run: ActiveRun, fix: Fix): ActiveRun {
  const next: ActiveRun = { ...run, accuracy: Math.round(fix.accuracy) };
  if (run.pausedAt != null || fix.accuracy > GOOD_ACCURACY) return next;
  const moving = movingSec(run, fix.time);
  const here = { lat: fix.lat, lng: fix.lng };
  if (!run.last) {
    return { ...next, last: { ...here, moving }, route: pushRoute(run.route, here) };
  }
  const d = haversine(run.last, here);
  if (d < MIN_STEP) return next;
  const dt = moving - run.last.moving;
  if (dt <= 0 || d / dt > MAX_SPEED) {
    // 튄 값 — 여러 번 이어지면(터널을 나왔거나 화면이 오래 꺼졌던 경우) 거리 없이 여기서 다시 시작
    if (run.rejected + 1 >= 5) return { ...next, last: { ...here, moving }, rejected: 0 };
    return { ...next, rejected: run.rejected + 1 };
  }
  const prevDist = run.distanceM;
  const distanceM = prevDist + d;
  // 1km 를 지났으면 구간 기록(지난 지점의 시간을 거리 비율로 나눠서)
  const splits = [...run.splits];
  let lastSplitAt = run.lastSplitAt;
  for (let km = Math.floor(prevDist / 1000) + 1; km * 1000 <= distanceM; km++) {
    const at = run.last.moving + ((km * 1000 - prevDist) / d) * dt;
    splits.push(Math.round(at - lastSplitAt));
    lastSplitAt = at;
  }
  const recent = [...run.recent, { moving, d: distanceM }].filter((p) => moving - p.moving <= 60);
  return {
    ...next,
    distanceM,
    last: { ...here, moving },
    rejected: 0,
    splits,
    lastSplitAt,
    recent,
    route: pushRoute(run.route, here),
  };
}

function pushRoute(route: LatLng[], p: { lat: number; lng: number }): LatLng[] {
  const point: LatLng = [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5];
  const prev = route[route.length - 1];
  if (prev && prev[0] === point[0] && prev[1] === point[1]) return route;
  const out = [...route, point];
  // 너무 길어지면 하나 걸러 하나씩 줄인다(모양은 그대로)
  return out.length > MAX_ROUTE_POINTS ? out.filter((_, i) => i % 2 === 0 || i === out.length - 1) : out;
}

export function pause(run: ActiveRun, now = Date.now()): ActiveRun {
  return run.pausedAt != null ? run : { ...run, pausedAt: now, last: null, recent: [] };
}

export function resume(run: ActiveRun, now = Date.now()): ActiveRun {
  return run.pausedAt == null ? run : { ...run, pausedMs: run.pausedMs + (now - run.pausedAt), pausedAt: null };
}

/** 최근 1분 동안의 페이스(초/km) — 50m 도 안 움직였으면 null */
export function currentPace(run: ActiveRun) {
  if (run.recent.length < 2) return null;
  const a = run.recent[0];
  const b = run.recent[run.recent.length - 1];
  const dd = b.d - a.d;
  if (dd < 50) return null;
  return ((b.moving - a.moving) / dd) * 1000;
}

/** 서버로 보낼 구간 — 이상하게 빠른 구간은 한도로 맞추고, 합이 시간보다 길어지면 구간 없이 보낸다 */
export function splitsForSave(run: ActiveRun, durationSec: number) {
  const s = run.splits.map((x) => Math.min(3600, Math.max(MIN_PACE_SEC, Math.round(x))));
  const sum = s.reduce((a, b) => a + b, 0);
  return sum > durationSec ? [] : s;
}

/** 5'24" */
export function formatPace(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec <= 0 || sec > 3600) return "-'--\"";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"`;
}

/** 5.20 */
export function formatKm(m: number) {
  return (Math.floor(m / 10) / 100).toFixed(2);
}

/** 음성 안내용 "5분 24초" */
export function spokenPace(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export function loadRun(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as ActiveRun;
    // 하루가 지난 러닝은 서버가 받지 않는다 — 남겨 두면 헷갈려서 버린다
    if (!r || typeof r.startedAt !== "number" || Date.now() - r.startedAt > 24 * 3600 * 1000) return null;
    return r;
  } catch {
    return null;
  }
}

export function saveRun(r: ActiveRun) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // 저장소를 못 쓰면 화면을 닫기 전까지만 유지
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

type StoredRoutes = { id: number; route: LatLng[] }[];

function readRoutes(): StoredRoutes {
  try {
    const raw = localStorage.getItem(ROUTES_KEY);
    const v = raw ? (JSON.parse(raw) as StoredRoutes) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** 경로는 이 기기에만 — 최근 30번까지 */
export function storeRoute(id: number, route: LatLng[]) {
  if (route.length < 2) return;
  const list = [{ id, route }, ...readRoutes().filter((r) => r.id !== id)].slice(0, MAX_ROUTES);
  try {
    localStorage.setItem(ROUTES_KEY, JSON.stringify(list));
  } catch {
    // 꽉 찼으면 오래된 것부터 줄여서 한 번 더
    try {
      localStorage.setItem(ROUTES_KEY, JSON.stringify(list.slice(0, 10)));
    } catch {
      // 포기 — 경로 그림만 없어진다
    }
  }
}

export function loadRoute(id: number): LatLng[] | null {
  return readRoutes().find((r) => r.id === id)?.route ?? null;
}

export function deleteRoute(id: number) {
  try {
    localStorage.setItem(ROUTES_KEY, JSON.stringify(readRoutes().filter((r) => r.id !== id)));
  } catch {
    // ignore
  }
}
