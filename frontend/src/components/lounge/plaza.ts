// 득근 광장(라운지) — 위에서 내려다보는 픽셀 광장. 홈 지도처럼 바닥을 누르면 그 자리로 걸어간다.
//
// 광장 28×40칸(한 칸 16px, 448×640). 화면에는 가로 17칸 정도가 보이고 카메라가 나를 따라간다.
// 위: 득근 헬스장 건물 · 게시판 · 랭킹 단상 · 단백질 자판기 / 가운데: 원판 분수 · 벤치 · 야외 운동기구 /
// 아래: 잔디 · 나무 · 남쪽 입구(처음 서는 곳).
// 사람 그림은 홈 지도와 같은 10×16 리프터(drawChar). 이름표 · 말풍선 · 이모트는 캔버스에 같이 그린다.
// 위치는 월드 픽셀(발 가운데)로 주고받는다 — 실시간 서버는 x · y 를 받아 범위만 자르고 그대로 전한다.
import { drawChar, palOf, toneForMbti, type Pal } from "../gymMap/engine";

export const TILE = 16;
export const COLS = 28;
export const ROWS = 40;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
/** 처음 서는 곳(남쪽 입구 안쪽) */
export const SPAWN: [number, number] = [13.5 * TILE, 35 * TILE + 12];
/** 화면에 보이는 가로 칸 수 */
const VIEW_COLS = 17;
const WALK = 84; // px/초
const REMOTE_MAX = 140;

export type EmoteKind = "wave" | "cheer" | "gg" | "clap";

/** 이모트 4개 — 실시간 서버 EMOTE_VALUES 와 같은 이름. say 는 머리 위 말풍선 */
export const EMOTES: { kind: EmoteKind; label: string; say: string }[] = [
  { kind: "wave", label: "인사", say: "안녕하세요!" },
  { kind: "cheer", label: "화이팅", say: "득근 화이팅!" },
  { kind: "gg", label: "GG", say: "GG!" },
  { kind: "clap", label: "박수", say: "짝짝짝" },
];

type Rect = { c: number; r: number; w: number; h: number };
export type PlazaZone = "board" | "podium" | "vending" | "fountain" | "workout";

export const PLAZA_ZONES: Record<PlazaZone, { name: string; trig: Rect; label: [number, number] }> = {
  board: { name: "게시판", trig: { c: 2, r: 6, w: 6, h: 1 }, label: [5, 3.4] },
  podium: { name: "랭킹 단상", trig: { c: 11, r: 8, w: 6, h: 1 }, label: [14, 3.4] },
  vending: { name: "단백질 자판기", trig: { c: 20, r: 6, w: 6, h: 1 }, label: [23, 3.4] },
  fountain: { name: "원판 분수", trig: { c: 10, r: 21, w: 8, h: 1 }, label: [14, 14.2] },
  workout: { name: "야외 운동기구", trig: { c: 21, r: 14, w: 5, h: 2 }, label: [23.5, 11.7] },
};

const OBJ: Rect[] = [
  { c: 0, r: 0, w: COLS, h: 3 }, // 건물
  { c: 0, r: 3, w: 1, h: 35 }, // 서쪽 울타리
  { c: COLS - 1, r: 3, w: 1, h: 35 }, // 동쪽 울타리
  { c: 0, r: 38, w: 11, h: 2 }, // 남쪽 담(서)
  { c: 17, r: 38, w: 11, h: 2 }, // 남쪽 담(동)
  { c: 2, r: 4, w: 6, h: 2 }, // 게시판
  { c: 11, r: 4, w: 6, h: 3 }, // 랭킹 단상
  { c: 20, r: 4, w: 6, h: 2 }, // 자판기
  { c: 11, r: 15, w: 6, h: 6 }, // 분수
  { c: 2, r: 12, w: 3, h: 1 }, // 벤치
  { c: 2, r: 17, w: 3, h: 1 },
  { c: 2, r: 22, w: 3, h: 1 },
  { c: 21, r: 13, w: 5, h: 1 }, // 철봉
  { c: 21, r: 18, w: 5, h: 2 }, // 평행봉
  { c: 2, r: 9, w: 1, h: 1 }, // 나무
  { c: 25, r: 9, w: 1, h: 1 },
  { c: 4, r: 28, w: 1, h: 1 },
  { c: 8, r: 31, w: 1, h: 1 },
  { c: 20, r: 29, w: 1, h: 1 },
  { c: 24, r: 32, w: 1, h: 1 },
  { c: 3, r: 26, w: 4, h: 1 }, // 꽃밭
  { c: 21, r: 25, w: 4, h: 1 },
];

const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
for (const o of OBJ) for (let r = o.r; r < o.r + o.h; r++) for (let c = o.c; c < o.c + o.w; c++) if (r < ROWS && c < COLS) solid[r][c] = true;
// 분수는 둥글게: 네 귀퉁이는 지나갈 수 있다
for (const [c, r] of [[11, 15], [16, 15], [11, 20], [16, 20]]) solid[r][c] = false;

export const walkable = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !solid[r][c];
const inRect = (q: Rect, c: number, r: number) => c >= q.c && c < q.c + q.w && r >= q.r && r < q.r + q.h;

export function zoneAt(c: number, r: number): PlazaZone | null {
  for (const [k, z] of Object.entries(PLAZA_ZONES) as [PlazaZone, (typeof PLAZA_ZONES)[PlazaZone]][]) if (inRect(z.trig, c, r)) return k;
  return null;
}

function findPath(sc: number, sr: number, tc: number, tr: number): [number, number][] | null {
  if (!walkable(tc, tr)) return null;
  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>();
  const q: [number, number][] = [[sc, sr]];
  prev.set(key(sc, sr), -1);
  while (q.length) {
    const [c, r] = q.shift()!;
    if (c === tc && r === tr) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkable(nc, nr) || prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), key(c, r));
      q.push([nc, nr]);
    }
  }
  if (!prev.has(key(tc, tr))) return null;
  const out: [number, number][] = [];
  for (let k = key(tc, tr); k !== -1; k = prev.get(k)!) out.unshift([k % COLS, Math.floor(k / COLS)]);
  return out.slice(1);
}

function nearestWalkable(c: number, r: number): [number, number] | null {
  for (let d = 0; d < 6; d++)
    for (let dr = -d; dr <= d; dr++)
      for (let dc = -d; dc <= d; dc++) if (Math.max(Math.abs(dc), Math.abs(dr)) === d && walkable(c + dc, r + dr)) return [c + dc, r + dr];
  return null;
}

/* ---------- 바닥 그림 ---------- */

const C = {
  ink: "#0E0E10", pave: "#2A2C31", paveL: "#33363C", seam: "#212226", plaza: "#383A41", plazaS: "#2E3036",
  lawn: "#2C5531", lawnL: "#376A3C", lawnD: "#244629", hedge: "#21412A", hedgeL: "#2F5A38",
  wall: "#34363C", wallCap: "#151517", win: "#F0D58A", winD: "#B89B4E", red: "#D9302A", redD: "#A8221D",
  blue: "#2F6FD0", yellow: "#F0BE2E", green: "#2E9C55", chalk: "#F3F1EA", steel: "#4A4C53", steelL: "#8A8F98",
  maple: "#C89157", mapleD: "#9C6B3B", water: "#3E7FB8", waterL: "#7DB3E0", board: "#EDEBE4", silver: "#B9BCC3", bronze: "#B4733A",
};

const fill = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 3×5 픽셀 숫자(단상 1 · 2 · 3) */
const DIGIT: Record<string, string[]> = { "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"], "3": ["##.", "..#", ".#.", "..#", "##."] };
function digit(g: CanvasRenderingContext2D, d: string, x: number, y: number, c: string) {
  DIGIT[d].forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && fill(g, x + i, y + j, 1, 1, c)));
}

function circle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

function tree(g: CanvasRenderingContext2D, c: number, r: number) {
  const x = c * TILE + 8;
  const y = r * TILE + 8;
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(x + 2, y + 6, 13, 6, 0, 0, Math.PI * 2);
  g.fill();
  fill(g, x - 2, y - 2, 4, 9, "#5A3A22");
  circle(g, x, y - 8, 13, C.ink);
  circle(g, x, y - 8, 12, C.hedge);
  circle(g, x - 3, y - 11, 8, C.hedgeL);
  circle(g, x - 5, y - 13, 3, "#4C8550");
}

function paintPlaza(g: CanvasRenderingContext2D) {
  const rnd = rng(77);
  // 보도블록
  fill(g, 0, 0, WORLD_W, WORLD_H, C.pave);
  for (let r = 3; r < 38; r++)
    for (let c = 1; c < COLS - 1; c++) {
      const x = c * TILE;
      const y = r * TILE;
      fill(g, x, y, TILE, 1, C.seam);
      fill(g, x + ((r % 2) * 8), y, 1, TILE, C.seam);
      if ((c + r) % 5 === 0) fill(g, x + 2, y + 3, 5, 4, C.paveL);
    }
  // 잔디(아래쪽 양옆) — 가운데는 입구로 가는 길
  for (const [c0, c1] of [[1, 10], [18, 27]] as const) {
    fill(g, c0 * TILE, 24 * TILE, (c1 - c0) * TILE, 14 * TILE, C.lawn);
    for (let i = 0; i < 260; i++) fill(g, c0 * TILE + ((rnd() * (c1 - c0) * TILE) | 0), 24 * TILE + ((rnd() * 14 * TILE) | 0), 1, 2, rnd() < 0.5 ? C.lawnL : C.lawnD);
    fill(g, c0 * TILE, 24 * TILE, (c1 - c0) * TILE, 2, C.ink);
  }
  // 가운데 광장(분수 둘레) 원형 포장
  circle(g, 14 * TILE, 18 * TILE, 92, C.plazaS);
  circle(g, 14 * TILE, 18 * TILE, 88, C.plaza);
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    fill(g, 14 * TILE + Math.cos(t) * 70, 18 * TILE + Math.sin(t) * 70, 2, 2, C.seam);
  }

  // 건물(득근 헬스장)
  fill(g, 0, 0, WORLD_W, 3 * TILE, C.wall);
  fill(g, 0, 0, WORLD_W, 6, C.wallCap);
  for (let x = 0; x < WORLD_W; x += 16) fill(g, x, 6, 1, 3 * TILE - 6, "#2C2E33");
  for (const wx of [24, 72, 120, 296, 344, 392]) {
    fill(g, wx - 1, 13, 26, 22, C.ink);
    fill(g, wx, 14, 24, 20, C.win);
    fill(g, wx, 26, 24, 8, C.winD);
    fill(g, wx + 11, 14, 2, 20, C.ink);
  }
  // 입구 문 + 원판 간판
  fill(g, 13 * TILE - 2, 18, 36, 30, C.ink);
  fill(g, 13 * TILE, 20, 32, 28, C.redD);
  fill(g, 13 * TILE + 15, 20, 2, 28, C.ink);
  circle(g, 14 * TILE, 10, 7, C.ink);
  circle(g, 14 * TILE, 10, 6, C.red);
  circle(g, 14 * TILE, 10, 2, C.silver);
  fill(g, 0, 3 * TILE - 2, WORLD_W, 2, C.ink);

  // 울타리(동서) · 담(남)
  for (const x of [0, WORLD_W - TILE]) {
    fill(g, x, 3 * TILE, TILE, 35 * TILE, C.hedge);
    for (let y = 3 * TILE; y < 38 * TILE; y += 8) fill(g, x + 3 + ((y / 8) % 2) * 5, y + 2, 6, 4, C.hedgeL);
  }
  for (const [x0, w] of [[0, 11 * TILE], [17 * TILE, 11 * TILE]]) {
    fill(g, x0, 38 * TILE, w, 2 * TILE, C.wall);
    fill(g, x0, 38 * TILE, w, 3, C.ink);
  }
  // 남쪽 입구 기둥(노랑 · 검정 줄)
  for (const x of [11 * TILE - 6, 17 * TILE]) {
    fill(g, x, 36 * TILE, 6, 4 * TILE, C.ink);
    for (let y = 36 * TILE; y < 40 * TILE; y += 8) fill(g, x + 1, y, 4, 4, C.yellow);
  }
  fill(g, 11 * TILE, 38 * TILE + 8, 6 * TILE, 3, C.yellow);

  // 게시판(화이트보드)
  fill(g, 2 * TILE, 4 * TILE, 6 * TILE, 2 * TILE, C.ink);
  fill(g, 2 * TILE + 2, 4 * TILE + 2, 6 * TILE - 4, 2 * TILE - 6, C.board);
  fill(g, 2 * TILE + 8, 4 * TILE + 7, 30, 2, C.blue);
  fill(g, 2 * TILE + 8, 4 * TILE + 12, 52, 2, "#5A6070");
  fill(g, 2 * TILE + 8, 4 * TILE + 17, 40, 2, "#5A6070");
  fill(g, 2 * TILE + 66, 4 * TILE + 6, 18, 14, C.yellow);
  fill(g, 2 * TILE + 4, 6 * TILE - 4, 6 * TILE - 8, 2, C.steelL);

  // 랭킹 단상(2 · 1 · 3)
  const pod = (x: number, top: number, col: string, d: string) => {
    fill(g, x, top, 32, 7 * TILE - top, C.ink);
    fill(g, x + 1, top + 1, 30, 7 * TILE - top - 2, col);
    fill(g, x + 1, top + 1, 30, 3, "rgba(255,255,255,0.35)");
    digit(g, d, x + 14, top + 8, C.ink);
  };
  pod(11 * TILE, 5 * TILE, C.silver, "2");
  pod(13 * TILE, 4 * TILE, C.yellow, "1");
  pod(15 * TILE, 5 * TILE + 8, C.bronze, "3");

  // 단백질 자판기 둘
  for (const [x, col] of [[20 * TILE + 4, C.red], [23 * TILE + 4, C.blue]] as const) {
    fill(g, x, 4 * TILE - 4, 40, 2 * TILE + 4, C.ink);
    fill(g, x + 2, 4 * TILE - 2, 36, 2 * TILE, col);
    fill(g, x + 5, 4 * TILE + 2, 22, 16, "#BFE3F2");
    for (let i = 0; i < 3; i++) fill(g, x + 8 + i * 7, 4 * TILE + 6, 4, 9, i === 1 ? C.yellow : C.chalk);
    fill(g, x + 30, 4 * TILE + 4, 5, 3, C.green);
    fill(g, x + 30, 4 * TILE + 10, 5, 3, C.green);
    fill(g, x + 6, 6 * TILE - 8, 22, 4, C.ink);
  }

  // 원판 분수: 빨간 원판 테두리 + 물 + 가운데 봉
  const fx = 14 * TILE;
  const fy = 18 * TILE;
  circle(g, fx + 3, fy + 5, 50, "rgba(0,0,0,0.3)");
  circle(g, fx, fy, 50, C.ink);
  circle(g, fx, fy, 48, C.red);
  circle(g, fx, fy, 40, C.redD);
  circle(g, fx, fy, 38, C.water);
  for (let i = 0; i < 40; i++) {
    const t = rnd() * Math.PI * 2;
    const d = 8 + rnd() * 26;
    fill(g, fx + Math.cos(t) * d, fy + Math.sin(t) * d, 3, 1, C.waterL);
  }
  circle(g, fx, fy, 9, C.ink);
  circle(g, fx, fy, 8, C.silver);
  circle(g, fx, fy, 3, C.steel);

  // 벤치(메이플)
  for (const r of [12, 17, 22]) {
    const x = 2 * TILE;
    const y = r * TILE;
    fill(g, x, y + 2, 3 * TILE, 12, C.ink);
    fill(g, x + 1, y + 3, 3 * TILE - 2, 4, C.maple);
    fill(g, x + 1, y + 8, 3 * TILE - 2, 4, C.mapleD);
    fill(g, x + 4, y + 14, 3, 2, C.ink);
    fill(g, x + 3 * TILE - 7, y + 14, 3, 2, C.ink);
  }

  // 야외 운동기구: 철봉 · 평행봉
  const post = (x: number, y: number, h: number) => {
    fill(g, x - 1, y - 1, 5, h + 2, C.ink);
    fill(g, x, y, 3, h, C.steelL);
  };
  post(21 * TILE + 2, 13 * TILE - 10, 24);
  post(26 * TILE - 5, 13 * TILE - 10, 24);
  fill(g, 21 * TILE + 2, 13 * TILE - 9, 5 * TILE - 4, 3, C.ink);
  fill(g, 21 * TILE + 3, 13 * TILE - 8, 5 * TILE - 6, 1, C.chalk);
  for (const y of [18 * TILE + 4, 19 * TILE + 8]) {
    post(21 * TILE + 4, y - 2, 8);
    post(26 * TILE - 7, y - 2, 8);
    fill(g, 21 * TILE + 4, y, 5 * TILE - 8, 3, C.ink);
    fill(g, 21 * TILE + 5, y + 1, 5 * TILE - 10, 1, C.yellow);
  }
  // 고무 매트(운동기구 아래)
  for (let y = 12 * TILE; y < 21 * TILE; y += 4) fill(g, 20 * TILE + 8, y, 6 * TILE - 8, 1, "#25272C");

  // 꽃밭
  for (const [c, r] of [[3, 26], [21, 25]]) {
    fill(g, c * TILE, r * TILE + 2, 4 * TILE, 12, C.mapleD);
    fill(g, c * TILE + 2, r * TILE + 4, 4 * TILE - 4, 8, "#3B2A1E");
    for (let i = 0; i < 10; i++) fill(g, c * TILE + 5 + i * 6, r * TILE + 5 + (i % 2) * 3, 3, 3, [C.red, C.yellow, C.chalk][i % 3]);
  }
  // 나무
  for (const [c, r] of [[2, 9], [25, 9], [4, 28], [8, 31], [20, 29], [24, 32]]) tree(g, c, r);
}

/* ---------- 엔진 ---------- */

export type PlazaPlayer = {
  id: string;
  name: string;
  level?: number;
  mbti?: string | null;
  tank?: string | null;
  x: number;
  y: number;
};

type Actor = PlazaPlayer & {
  pal: Pal;
  tx: number;
  ty: number;
  path: [number, number][];
  frame: number;
  step: number;
  bubble: { text: string; until: number; tone: "chat" | "emote" } | null;
};

export type PlazaCallbacks = {
  /** 내 위치가 바뀜(100ms 마다 묶어서) */
  onMove: (x: number, y: number) => void;
  onTapPlayer: (id: string) => void;
  onZone: (zone: PlazaZone | null) => void;
};

export type PlazaController = {
  setPlayers: (list: PlazaPlayer[]) => void;
  say: (id: string, text: string, tone?: "chat" | "emote") => void;
  walkToZone: (zone: PlazaZone) => void;
  destroy: () => void;
};

const toPal = (p: Pick<PlazaPlayer, "mbti" | "tank">): Pal => {
  const tone = toneForMbti(p.mbti);
  return palOf(p.tank ? { ...tone, tank: p.tank } : tone);
};

const inWorld = (x: number, y: number) => x > 0 && y > 0 && x < WORLD_W && y < WORLD_H && walkable(Math.floor(x / TILE), Math.floor(y / TILE));

/** start: 처음 설 자리(월드 픽셀, 없거나 못 서는 곳이면 남쪽 입구) */
export function createPlaza(canvas: HTMLCanvasElement, me: Omit<PlazaPlayer, "x" | "y">, cb: PlazaCallbacks, start?: [number, number]): PlazaController {
  const g = canvas.getContext("2d")!;
  const bg = document.createElement("canvas");
  bg.width = WORLD_W;
  bg.height = WORLD_H;
  paintPlaza(bg.getContext("2d")!);

  // 입구 네 칸 중 한 곳(여럿이 같은 자리에 겹쳐 서지 않게)
  const gate: [number, number] = [(12 + Math.floor(Math.random() * 4)) * TILE + 8, SPAWN[1]];
  const [sx, sy] = start && inWorld(start[0], start[1]) ? start : gate;
  const mine: Actor = { ...me, x: sx, y: sy, pal: toPal(me), tx: sx, ty: sy, path: [], frame: 0, step: 0, bubble: null };
  const others = new Map<string, Actor>();
  let zone: PlazaZone | null = null;
  let lastSent = 0;
  let dirty = true;
  let raf = 0;
  let last = performance.now();
  let scale = 1;
  let cam = { x: 0, y: 0 };
  let tapMark: { x: number; y: number; t: number } | null = null;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    scale = rect.width / (VIEW_COLS * TILE);
    dirty = true;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const emitMove = (force = false) => {
    const now = performance.now();
    if (!force && now - lastSent < 100) return;
    lastSent = now;
    cb.onMove(Math.round(mine.x), Math.round(mine.y));
  };
  emitMove(true);

  const goTile = (c: number, r: number) => {
    const target = walkable(c, r) ? [c, r] : nearestWalkable(c, r);
    if (!target) return;
    const path = findPath(Math.floor(mine.x / TILE), Math.floor(mine.y / TILE), target[0], target[1]);
    if (path && path.length) mine.path = path;
  };

  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left) / scale + cam.x;
    const wy = (e.clientY - rect.top) / scale + cam.y;
    // 사람을 누르면(머리~발 상자) 그 사람 정보
    for (const a of others.values()) {
      if (Math.abs(wx - a.x) < 8 && wy > a.y - 20 && wy < a.y + 3) {
        cb.onTapPlayer(a.id);
        return;
      }
    }
    tapMark = { x: wx, y: wy, t: performance.now() };
    goTile(Math.floor(wx / TILE), Math.floor(wy / TILE));
  };
  canvas.addEventListener("pointerdown", onPointer);

  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    if (e.type === "keydown") keys.add(e.key);
    else keys.delete(e.key);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  const stepMine = (dt: number) => {
    // 방향키: 한 칸씩
    if (!mine.path.length && keys.size) {
      const c = Math.floor(mine.x / TILE);
      const r = Math.floor(mine.y / TILE);
      const d = keys.has("ArrowUp") ? [0, -1] : keys.has("ArrowDown") ? [0, 1] : keys.has("ArrowLeft") ? [-1, 0] : [1, 0];
      if (walkable(c + d[0], r + d[1])) mine.path = [[c + d[0], r + d[1]]];
    }
    if (!mine.path.length) return false;
    const [c, r] = mine.path[0];
    const tx = c * TILE + 8;
    const ty = r * TILE + 12;
    const dx = tx - mine.x;
    const dy = ty - mine.y;
    const dist = Math.hypot(dx, dy);
    const move = WALK * dt;
    if (dist <= move) {
      mine.x = tx;
      mine.y = ty;
      mine.path.shift();
    } else {
      mine.x += (dx / dist) * move;
      mine.y += (dy / dist) * move;
    }
    mine.step += dt;
    emitMove(!mine.path.length);
    return true;
  };

  const stepOther = (a: Actor, dt: number) => {
    const dx = a.tx - a.x;
    const dy = a.ty - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return false;
    if (dist > 96) {
      a.x = a.tx;
      a.y = a.ty;
      return true;
    }
    const move = Math.min(dist, Math.max(WALK, dist * 4) * dt, REMOTE_MAX * dt);
    a.x += (dx / dist) * move;
    a.y += (dy / dist) * move;
    a.step += dt;
    return true;
  };

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const label = (text: string, x: number, y: number, bg2: string, fg: string, size = 6) => {
    g.font = `700 ${size}px "IBM Plex Sans KR", sans-serif`;
    const w = g.measureText(text).width + 6;
    roundRect(x - w / 2, y - size - 3, w, size + 4, 2);
    g.fillStyle = C.ink;
    g.fill();
    roundRect(x - w / 2 + 0.6, y - size - 2.4, w - 1.2, size + 2.8, 1.6);
    g.fillStyle = bg2;
    g.fill();
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(text, x, y - 1.2);
  };

  const wrap = (text: string, maxW: number) => {
    const out: string[] = [];
    let cur = "";
    for (const ch of text) {
      if (g.measureText(cur + ch).width > maxW && cur) {
        out.push(cur);
        cur = ch;
        if (out.length === 2) break;
      } else cur += ch;
    }
    if (out.length < 2 && cur) out.push(cur);
    else if (out.length === 2 && cur && out.join("").length < text.length) out[1] = out[1].slice(0, -1) + "…";
    return out;
  };

  const bubble = (a: Actor, now: number) => {
    if (!a.bubble) return;
    if (now > a.bubble.until) {
      a.bubble = null;
      return;
    }
    g.font = `600 6px "IBM Plex Sans KR", sans-serif`;
    const lines = wrap(a.bubble.text, 70);
    const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 8;
    const h = lines.length * 8 + 4;
    const x = a.x - w / 2;
    const y = a.y - 30 - h;
    roundRect(x, y, w, h, 3);
    g.fillStyle = C.ink;
    g.fill();
    roundRect(x + 0.8, y + 0.8, w - 1.6, h - 1.6, 2.4);
    g.fillStyle = a.bubble.tone === "emote" ? C.yellow : C.chalk;
    g.fill();
    g.fillStyle = C.ink;
    g.beginPath();
    g.moveTo(a.x - 2, y + h - 0.5);
    g.lineTo(a.x + 2, y + h - 0.5);
    g.lineTo(a.x, y + h + 3);
    g.fill();
    g.textAlign = "left";
    g.textBaseline = "top";
    lines.forEach((l, i) => g.fillText(l, x + 4, y + 2.6 + i * 8));
  };

  const render = (now: number) => {
    const rect = canvas.getBoundingClientRect();
    const viewW = rect.width / scale;
    const viewH = rect.height / scale;
    cam = {
      x: Math.max(0, Math.min(WORLD_W - viewW, mine.x - viewW / 2)),
      y: Math.max(0, Math.min(WORLD_H - viewH, mine.y - viewH / 2)),
    };
    const k = (canvas.width / rect.width) * scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = C.ink;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    g.drawImage(bg, 0, 0);

    // 누른 자리 표시
    if (tapMark && now - tapMark.t < 500) {
      const t = (now - tapMark.t) / 500;
      g.strokeStyle = `rgba(240,190,46,${1 - t})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(tapMark.x, tapMark.y, 4 + t * 6, 2 + t * 3, 0, 0, Math.PI * 2);
      g.stroke();
    }

    // 사람: 아래쪽이 앞(y 순)
    const actors = [...others.values(), mine].sort((a, b) => a.y - b.y);
    for (const a of actors) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.ellipse(a.x, a.y + 1, 5, 2, 0, 0, Math.PI * 2);
      g.fill();
      const moving = a === mine ? mine.path.length > 0 : Math.hypot(a.tx - a.x, a.ty - a.y) > 0.5;
      const frame = moving ? 1 + (Math.floor(a.step * 8) % 2) : 0;
      drawChar(g, Math.round(a.x - 5), Math.round(a.y - 16), a.pal, { frame });
    }
    for (const a of actors) {
      const isMe = a === mine;
      label(a.level ? `${a.name} Lv.${a.level}` : a.name, a.x, a.y - 19, isMe ? C.yellow : "#1F2024", isMe ? C.ink : C.chalk);
      bubble(a, now);
    }
    // 장소 이름표
    for (const [k2, z] of Object.entries(PLAZA_ZONES) as [PlazaZone, (typeof PLAZA_ZONES)[PlazaZone]][]) {
      label(z.name, z.label[0] * TILE, z.label[1] * TILE, zone === k2 ? C.yellow : "#1F2024", zone === k2 ? C.ink : C.chalk, 6.5);
    }
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moved = stepMine(dt);
    for (const a of others.values()) moved = stepOther(a, dt) || moved;
    const here = zoneAt(Math.floor(mine.x / TILE), Math.floor(mine.y / TILE));
    if (here !== zone) {
      zone = here;
      dirty = true;
      cb.onZone(zone);
    }
    // 움직임 · 말풍선 · 누른 자리 표시가 있을 때만 다시 그린다
    const busy = moved || dirty || [...others.values(), mine].some((a) => a.bubble) || (tapMark && now - tapMark.t < 600);
    if (busy) render(now);
    dirty = false;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  // 이름표 글꼴이 늦게 오면 한 번 더 그린다
  void document.fonts?.ready.then(() => {
    dirty = true;
  });

  return {
    setPlayers(list) {
      const seen = new Set<string>();
      for (const p of list) {
        if (p.id === me.id) continue;
        seen.add(p.id);
        const ok = inWorld(p.x, p.y);
        const x = ok ? p.x : SPAWN[0];
        const y = ok ? p.y : SPAWN[1];
        const a = others.get(p.id);
        if (a) {
          Object.assign(a, { name: p.name, level: p.level, mbti: p.mbti, tank: p.tank, tx: x, ty: y });
          a.pal = toPal(p);
        } else {
          others.set(p.id, { ...p, x, y, tx: x, ty: y, pal: toPal(p), path: [], frame: 0, step: 0, bubble: null });
        }
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
      dirty = true;
    },
    say(id, text, tone = "chat") {
      const a = id === me.id ? mine : others.get(id);
      if (!a) return;
      a.bubble = { text, until: performance.now() + (tone === "emote" ? 2500 : 4500), tone };
      dirty = true;
    },
    walkToZone(z) {
      const t = PLAZA_ZONES[z].trig;
      goTile(t.c + Math.floor(t.w / 2), t.r);
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    },
  };
}
