// 헬스장 지도 엔진 — 홈 첫 화면의 픽셀 헬스장(캔버스).
//
// 화면은 256×416 픽셀(16×26 칸, 한 칸 16px)로 그리고 CSS 로 늘린다(image-rendering: pixelated).
// React 는 HUD · 장소 이름표 · 아래 창(시트)을 맡고, 이 파일은 그림 · 길찾기 · 걷기 · 출석 연출만 맡는다.
//
// 데이터 → 그림
//   plates      이번 주 운동한 날 수. 파워랙 바벨에 원판이 그만큼 꽂힌다(색 순서는 gym/plates.ts).
//   checked     오늘 출석 여부. 출석 체크기 화면이 노랑(대기) / 초록(완료), 빨간 느낌표는 대기일 때만.
//   loungeCount 라운지 실시간 인원. 라운지 벤치에 최대 3명까지 앉는다(이름은 붙이지 않는다).
//   tone        내 캐릭터 색(MBTI 계열 → AvatarRenderer 와 같은 규칙).

import { PLATE_ORDER } from "../gym/plates";

export const TILE = 16;
export const COLS = 16;
export const ROWS = 26;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

export type ZoneId = "checkin" | "rack" | "mirror" | "board" | "lounge" | "crew" | "community";
type Rect = { c: number; r: number; w: number; h: number };
export type ZoneSpec = {
  name: string;
  /** 이 장소에서 열리는 실제 화면 */
  page: string;
  trig: Rect;
  anchor: [number, number];
  /** 이름표 위치(칸 단위) */
  label: [number, number];
  /** 강조 테두리(픽셀) */
  box: [number, number, number, number];
};

export const ZONES: Record<ZoneId, ZoneSpec> = {
  checkin: { name: "출석 체크기", page: "출석", trig: { c: 9, r: 22, w: 2, h: 2 }, anchor: [9, 22], label: [10, 19.6], box: [146, 316, 30, 38] },
  rack: { name: "파워랙", page: "내 기록", trig: { c: 2, r: 4, w: 4, h: 3 }, anchor: [3, 4], label: [4, 1.15], box: [12, 20, 104, 46] },
  mirror: { name: "거울", page: "캐릭터", trig: { c: 9, r: 3, w: 6, h: 2 }, anchor: [11, 3], label: [12, 0.55], box: [144, 5, 96, 44] },
  board: { name: "화이트보드", page: "이벤트", trig: { c: 1, r: 11, w: 4, h: 2 }, anchor: [2, 11], label: [3, 8], box: [14, 134, 68, 44] },
  lounge: { name: "라운지", page: "라운지", trig: { c: 9, r: 10, w: 5, h: 3 }, anchor: [11, 11], label: [12, 8], box: [142, 136, 100, 90] },
  crew: { name: "러닝머신", page: "운동모임", trig: { c: 9, r: 18, w: 6, h: 2 }, anchor: [11, 18], label: [12, 15.5], box: [142, 254, 100, 36] },
  community: { name: "게시판", page: "커뮤니티", trig: { c: 1, r: 18, w: 4, h: 2 }, anchor: [2, 18], label: [3, 15.2], box: [14, 248, 68, 42] },
};
export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];

const OBJ: (Rect & { zone?: ZoneId })[] = [
  { c: 2, r: 2, w: 4, h: 2, zone: "rack" },
  { c: 10, r: 2, w: 5, h: 1, zone: "mirror" },
  { c: 1, r: 9, w: 4, h: 2, zone: "board" },
  { c: 10, r: 9, w: 5, h: 1, zone: "lounge" },
  { c: 10, r: 13, w: 5, h: 1, zone: "lounge" },
  { c: 14, r: 11, w: 1, h: 1, zone: "lounge" },
  { c: 9, r: 16, w: 6, h: 2, zone: "crew" },
  { c: 1, r: 16, w: 4, h: 2, zone: "community" },
  { c: 2, r: 21, w: 4, h: 1 },
  { c: 9, r: 21, w: 2, h: 1, zone: "checkin" },
  { c: 1, r: 23, w: 1, h: 1 },
  { c: 14, r: 23, w: 1, h: 1 },
  { c: 14, r: 6, w: 1, h: 1 },
];

const START: [number, number] = [7, 24];
/** 걷는 속도(칸/초). 바로 가기는 FAST_SPEED */
const WALK_SPEED = 13;
const FAST_SPEED = 44;

const C = {
  floor: "#232428", seam: "#1B1C1F", speck: "#2D2E33", wallFace: "#34363C", wallCap: "#151517", rivet: "#5C5F66",
  maple: "#C89157", mapleD: "#A47141", mapleE: "#7E532D", steel: "#4A4C53", steelD: "#2E3035", steelL: "#6B6E76",
  chalk: "#F3F1EA", ink: "#0E0E10", red: "#D9302A", blue: "#2F6FD0", yellow: "#F0BE2E", green: "#2E9C55",
  board: "#EDEBE4", cork: "#A87444", mirror: "#8FA9BA", mirrorL: "#C9DAE4", rug: "#262B33",
};

export type Tone = { skin: string; tank: string; hair: string };
/** AvatarRenderer 의 MBTI 색 규칙과 같다 */
export function toneForMbti(mbti?: string | null): Tone {
  const v = (mbti ?? "").toUpperCase();
  if (v.includes("NT")) return { skin: "#f3c7a9", tank: "#2F6FD0", hair: "#1e293b" };
  if (v.includes("NF")) return { skin: "#f4c8b4", tank: "#F0BE2E", hair: "#3f3f46" };
  if (v.includes("SJ")) return { skin: "#edc2a5", tank: "#2E9C55", hair: "#292524" };
  if (v.includes("SP")) return { skin: "#f1c6aa", tank: "#D9302A", hair: "#1f2937" };
  return { skin: "#E8B98F", tank: "#D9302A", hair: "#2B2420" };
}

type Pal = Record<"h" | "s" | "k" | "r" | "b" | "w", string>;
const palOf = (t: Tone): Pal => ({ h: t.hair, s: t.skin, k: C.ink, r: t.tank, b: "#2C2D31", w: C.chalk });
const GUESTS: Pal[] = [
  { h: "#5A3A22", s: "#F0C7A0", k: C.ink, r: C.blue, b: "#2C2D31", w: C.chalk },
  { h: "#16161A", s: "#D9A577", k: C.ink, r: C.yellow, b: "#2C2D31", w: C.chalk },
  { h: "#7A4A2A", s: "#EDBD95", k: C.ink, r: C.green, b: "#3B3D44", w: C.chalk },
];
const SEATS: [number, number][] = [[166, 141], [198, 141], [212, 205]];
/** 바벨 원판 높이(픽셀) — PLATE_ORDER 순서 */
const PLATE_H = [14, 14, 12, 10, 7, 6, 5];

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

/* ---------- 칸 · 길찾기 ---------- */

const solid: number[][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => (r < 2 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? 1 : 0)),
);
OBJ.forEach((o) => {
  for (let r = o.r; r < o.r + o.h; r++) for (let c = o.c; c < o.c + o.w; c++) solid[r][c] = 1;
});
const walkable = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !solid[r][c];
const inRect = (q: Rect, c: number, r: number) => c >= q.c && c < q.c + q.w && r >= q.r && r < q.r + q.h;
export function zoneAt(c: number, r: number): ZoneId | null {
  return ZONE_IDS.find((k) => inRect(ZONES[k].trig, c, r)) ?? null;
}

function findPath(sc: number, sr: number, tc: number, tr: number): [number, number][] | null {
  if (!walkable(tc, tr)) return null;
  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>([[key(sc, sr), -1]]);
  const queue: [number, number][] = [[sc, sr]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    if (c === tc && r === tr) {
      const out: [number, number][] = [];
      let k = key(c, r);
      while (k !== -1) {
        out.push([k % COLS, Math.floor(k / COLS)]);
        k = prev.get(k)!;
      }
      out.reverse();
      out.shift();
      return out;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (walkable(nc, nr) && !prev.has(key(nc, nr))) {
        prev.set(key(nc, nr), key(c, r));
        queue.push([nc, nr]);
      }
    }
  }
  return null;
}

function nearestWalkable(c: number, r: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (walkable(x, y)) {
        const d = Math.abs(x - c) + Math.abs(y - r);
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
  return best;
}

/* ---------- 고정 배경 ---------- */

function paintStatic(g: CanvasRenderingContext2D) {
  const rnd = rng(11);
  const W = MAP_W;
  const H = MAP_H;
  fill(g, 0, 0, W, H, C.floor);
  for (let r = 2; r < 25; r += 2) fill(g, 16, r * TILE, W - 32, 1, C.seam);
  for (let c = 1; c < 15; c += 2) fill(g, c * TILE, 32, 1, H - 48, C.seam);
  for (let i = 0; i < 520; i++) fill(g, 16 + ((rnd() * (W - 32)) | 0), 32 + ((rnd() * (H - 48)) | 0), 1, 1, rnd() < 0.5 ? C.speck : "#1E1F22");
  // 메이플 플랫폼
  fill(g, 16, 32, 96, 96, C.maple);
  for (let y = 38; y < 128; y += 6) fill(g, 16, y, 96, 1, C.mapleD);
  for (let i = 0; i < 16; i++) fill(g, 18 + ((rnd() * 90) | 0), 38 + ((rnd() * 15) | 0) * 6 - 5, 1, 5, C.mapleD);
  fill(g, 16, 32, 96, 1, C.mapleE);
  fill(g, 16, 127, 96, 1, C.mapleE);
  fill(g, 16, 32, 1, 96, C.mapleE);
  fill(g, 111, 32, 1, 96, C.mapleE);
  for (let i = 0; i < 36; i++) fill(g, 40 + ((rnd() * 48) | 0), 72 + ((rnd() * 44) | 0), 1, 1, "#E8D9C0");
  // 라운지 러그
  fill(g, 144, 144, 96, 80, C.rug);
  fill(g, 144, 144, 96, 1, "#34507A");
  fill(g, 144, 223, 96, 1, "#34507A");
  fill(g, 144, 144, 1, 80, "#34507A");
  fill(g, 239, 144, 1, 80, "#34507A");
  // 입구 매트
  fill(g, 96, 368, 64, 32, "#18181A");
  for (let x = 96; x < 160; x += 4) {
    fill(g, x, 368, 2, 2, C.yellow);
    fill(g, x + 2, 398, 2, 2, C.yellow);
  }
  // 바닥 원판 로고
  g.save();
  g.lineWidth = 4;
  g.strokeStyle = "#3E1C19";
  g.beginPath();
  g.arc(120, 216, 21, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = "#35201D";
  g.beginPath();
  g.arc(120, 216, 8, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // 벽
  fill(g, 0, 0, W, 32, C.wallFace);
  fill(g, 0, 0, W, 5, C.wallCap);
  fill(g, 0, 18, W, 1, "#2A2C31");
  for (let x = 0; x < W; x += 32) {
    fill(g, x, 5, 1, 27, "#2A2C31");
    for (const [dx, dy] of [[3, 8], [28, 8], [3, 28], [28, 28]]) fill(g, x + dx, dy, 1, 1, C.rivet);
  }
  fill(g, 0, 31, W, 1, C.ink);
  fill(g, 0, 32, 16, H - 48, "#2A2B30");
  fill(g, 15, 32, 1, H - 48, C.ink);
  fill(g, W - 16, 32, 16, H - 48, "#2A2B30");
  fill(g, W - 16, 32, 1, H - 48, C.ink);
  for (let y = 40; y < H - 16; y += 32) {
    fill(g, 6, y, 1, 1, C.rivet);
    fill(g, W - 7, y, 1, 1, C.rivet);
  }
  fill(g, 0, H - 16, W, 16, C.wallCap);
  fill(g, 0, H - 16, W, 1, C.ink);
  fill(g, 112, H - 16, 32, 16, "#0A0A0B");
  for (let x = 112; x < 144; x += 4) fill(g, x, H - 16, 2, 2, C.yellow);
  // 거울
  fill(g, 146, 7, 92, 24, C.steelL);
  fill(g, 148, 9, 88, 21, C.mirror);
  for (const sx of [154, 158, 186, 206, 210]) for (let k = 0; k < 18; k++) if (sx + k < 236) fill(g, sx + k, 28 - k, 1, 1, C.mirrorL);
  // 파워랙 기둥
  fill(g, 44, 18, 4, 46, C.steel);
  fill(g, 44, 18, 1, 46, C.steelL);
  fill(g, 80, 18, 4, 46, C.steel);
  fill(g, 80, 18, 1, 46, C.steelL);
  fill(g, 44, 18, 40, 3, C.steelD);
  fill(g, 40, 62, 12, 3, C.steelD);
  fill(g, 76, 62, 12, 3, C.steelD);
  fill(g, 41, 42, 3, 2, C.yellow);
  fill(g, 84, 42, 3, 2, C.yellow);
  // 덤벨 랙
  fill(g, 160, 33, 2, 15, C.steel);
  fill(g, 238, 33, 2, 15, C.steel);
  fill(g, 160, 36, 80, 2, C.steelD);
  fill(g, 160, 45, 80, 2, C.steelD);
  const accents = [C.red, C.blue, C.yellow, C.green];
  for (let i = 0; i < 6; i++)
    for (const y of [31, 40]) {
      const x = 165 + i * 12;
      const accent = accents[(i + (y > 35 ? 2 : 0)) % 4];
      fill(g, x, y, 3, 5, C.ink);
      fill(g, x + 6, y, 3, 5, C.ink);
      fill(g, x + 3, y + 2, 3, 1, C.steelL);
      fill(g, x, y, 3, 1, accent);
      fill(g, x + 6, y, 3, 1, accent);
    }
  // 화이트보드
  fill(g, 22, 166, 2, 10, C.steel);
  fill(g, 72, 166, 2, 10, C.steel);
  fill(g, 16, 136, 64, 32, C.steelL);
  fill(g, 18, 138, 60, 27, C.board);
  fill(g, 22, 142, 22, 1, C.red);
  fill(g, 22, 146, 30, 1, C.blue);
  fill(g, 22, 150, 18, 1, "#55575E");
  fill(g, 22, 154, 26, 1, C.blue);
  fill(g, 52, 157, 18, 1, C.ink);
  fill(g, 52, 154, 2, 7, C.red);
  fill(g, 68, 154, 2, 7, C.red);
  fill(g, 18, 165, 60, 2, C.steelD);
  // 라운지 벤치 · 정수기
  for (const y of [144, 208]) {
    fill(g, 160, y + 4, 80, 9, C.ink);
    fill(g, 161, y + 5, 78, 6, "#3B3D44");
    fill(g, 161, y + 5, 78, 1, "#4C4F57");
    for (const lx of [164, 198, 233]) fill(g, lx, y + 12, 3, 4, C.steelD);
  }
  fill(g, 225, 167, 14, 26, C.ink);
  fill(g, 226, 180, 12, 12, "#D9D7CF");
  fill(g, 228, 168, 8, 12, "#6FA8DC");
  fill(g, 229, 169, 2, 9, "#A9CCEA");
  fill(g, 230, 184, 2, 2, C.red);
  // 러닝머신
  for (let i = 0; i < 3; i++) {
    const x = 144 + i * 32;
    fill(g, x + 2, 256, 28, 32, C.ink);
    fill(g, x + 3, 257, 26, 6, C.steel);
    fill(g, x + 12, 258, 8, 3, "#1E3A22");
    fill(g, x + 3, 263, 2, 24, C.steelD);
    fill(g, x + 27, 263, 2, 24, C.steelD);
    fill(g, x + 5, 263, 22, 24, "#141517");
    for (let y = 265; y < 287; y += 4) fill(g, x + 5, y, 22, 1, "#1C1D20");
  }
  // 게시판
  fill(g, 22, 278, 2, 10, C.steel);
  fill(g, 72, 278, 2, 10, C.steel);
  fill(g, 16, 250, 64, 30, C.mapleE);
  fill(g, 18, 252, 60, 26, C.cork);
  for (let i = 0; i < 40; i++) fill(g, 18 + ((rnd() * 60) | 0), 252 + ((rnd() * 26) | 0), 1, 1, "#956538");
  const notes: [number, number, number, number, string][] = [
    [22, 255, 12, 10, C.chalk], [37, 257, 11, 9, C.yellow], [51, 254, 12, 11, "#9EC1E8"], [65, 258, 9, 9, C.chalk],
    [23, 267, 14, 8, "#F2A79F"], [41, 268, 12, 8, C.chalk], [57, 267, 14, 9, C.yellow],
  ];
  for (const [x, y, w, h, col] of notes) {
    fill(g, x, y, w, h, col);
    fill(g, x + 2, y + 3, w - 4, 1, "#77797F");
    if (h > 8) fill(g, x + 2, y + 5, w - 6, 1, "#77797F");
    fill(g, x + (w >> 1), y, 1, 1, C.red);
  }
  // 카운터
  fill(g, 32, 330, 64, 22, C.ink);
  fill(g, 33, 331, 62, 6, C.maple);
  fill(g, 33, 331, 62, 1, "#DDAA74");
  fill(g, 33, 337, 62, 14, C.steel);
  for (let x = 48; x < 96; x += 16) fill(g, x, 337, 1, 14, C.steelD);
  fill(g, 59, 340, 9, 8, C.ink);
  fill(g, 60, 341, 7, 6, C.red);
  fill(g, 62, 343, 3, 2, C.ink);
  fill(g, 72, 321, 14, 10, C.ink);
  fill(g, 73, 322, 12, 7, "#22324A");
  // 출석 체크기 몸체
  fill(g, 148, 318, 24, 34, C.ink);
  fill(g, 149, 319, 22, 32, C.steel);
  fill(g, 149, 319, 1, 32, C.steelL);
  fill(g, 151, 322, 18, 12, "#111111");
  fill(g, 159, 320, 2, 1, "#9A9DA5");
  fill(g, 153, 342, 14, 2, C.steelD);
  // 화분
  for (const [c, r] of [[1, 23], [14, 23], [14, 6]]) {
    const x = c * TILE;
    const y = r * TILE;
    fill(g, x + 1, y - 2, 14, 12, C.ink);
    fill(g, x + 2, y - 1, 12, 10, "#2F6B3A");
    fill(g, x + 4, y - 1, 6, 4, "#3E8A4B");
    fill(g, x + 9, y + 3, 3, 3, "#56A866");
    fill(g, x + 3, y + 9, 10, 7, C.ink);
    fill(g, x + 4, y + 10, 8, 5, "#5B4636");
  }
}

/* ---------- 캐릭터 (10×16 픽셀) ---------- */

const BASE = ["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".skssssks.", ".ssssssss.", "..ssssss..", "...ssss...", ".rrrrrrrr.", "srrrrrrrrs", "srrrrrrrrs", "ss.rrrr.ss", "..bbbbbb.."];
const LEGS = [
  ["..bb..bb..", "..ss..ss..", "..ss..ss..", "..ww..ww.."],
  ["..bb..bb..", "..ss..ss..", "..ww..ss..", "......ww.."],
  ["..bb..bb..", "..ss..ss..", "..ss..ww..", "..ww......"],
];
type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean };

function drawChar(g: CanvasRenderingContext2D, x: number, y: number, pal: Pal, o: CharOpts = {}) {
  let rows = o.sit ? BASE.slice() : BASE.concat(LEGS[o.frame ?? 0]);
  if (o.back) {
    rows = rows.slice();
    rows[2] = ".hhhhhhhh.";
    rows[3] = ".hhhhhhhh.";
    rows[4] = ".shhhhhhs.";
  }
  if (o.over) rows = rows.map((row, i) => (i >= 8 && i <= 10 ? `.${row.slice(1, 9)}.` : row));
  g.fillStyle = C.ink;
  rows.forEach((row, j) => {
    for (let i = 0; i < 10; i++)
      if (row[i] !== ".") {
        g.fillRect(x + i - 1, y + j, 3, 1);
        g.fillRect(x + i, y + j - 1, 1, 3);
      }
  });
  if (o.over) {
    fill(g, x - 1, y - 3, 3, 13, C.ink);
    fill(g, x + 8, y - 3, 3, 13, C.ink);
    fill(g, x - 7, y - 4, 24, 3, C.ink);
    fill(g, x - 6, y - 8, 4, 11, C.ink);
    fill(g, x + 12, y - 8, 4, 11, C.ink);
  }
  rows.forEach((row, j) => {
    for (let i = 0; i < 10; i++) {
      const ch = row[i] as keyof Pal | ".";
      if (ch === ".") continue;
      g.fillStyle = pal[ch];
      g.fillRect(x + i, y + j, 1, 1);
    }
  });
  if (o.over) {
    fill(g, x, y - 2, 1, 11, pal.s);
    fill(g, x + 9, y - 2, 1, 11, pal.s);
    fill(g, x - 6, y - 3, 22, 1, "#B9BCC3");
    fill(g, x - 5, y - 7, 2, 9, C.red);
    fill(g, x + 13, y - 7, 2, 9, C.red);
  }
}

/* ---------- 컨트롤러 ---------- */

export type MapState = { plates: number; checked: boolean; loungeCount: number; tone: Tone };
export type MapCallbacks = {
  /** 캐릭터가 장소에 도착(또는 떠남) */
  onZone: (zone: ZoneId | null) => void;
  /** 매 프레임 캐릭터 머리 위치(픽셀, 지도 좌표) — 이름표 위치용 */
  onPlayer: (x: number, y: number) => void;
  /** 원판이 바벨에 꽂히는 순간 */
  onPlateLanded: () => void;
};
export type GymMapController = {
  setState: (next: Partial<MapState>) => void;
  tapAt: (fx: number, fy: number) => void;
  goZone: (zone: ZoneId, fast?: boolean) => void;
  step: (dc: number, dr: number) => void;
  celebrate: () => void;
  /** 창을 닫았을 때 강조만 끈다(다시 누르면 다시 열린다) */
  clearZone: () => void;
  destroy: () => void;
};

type Walker = { x: number; y: number; path: [number, number][]; speed: number; anim: number; moving: boolean; back: boolean };
type Flight = { t0: number; dur: number; done: () => void };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; age: number };

export function createGymMap(canvas: HTMLCanvasElement, initial: MapState, cb: MapCallbacks): GymMapController {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas 2d unavailable");
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bg = document.createElement("canvas");
  bg.width = MAP_W;
  bg.height = MAP_H;
  const bgCtx = bg.getContext("2d");
  if (bgCtx) paintStatic(bgCtx);

  let state: MapState = { ...initial };
  let pal = palOf(state.tone);
  /** 화면에 꽂혀 보이는 원판 수(출석 연출 중에는 state.plates 보다 하나 적다) */
  let shownPlates = state.plates;
  const player: Walker = { x: START[0], y: START[1], path: [], speed: WALK_SPEED, anim: 0, moving: false, back: true };
  let overUntil = 0;
  let zone: ZoneId | null = null;
  let flights: Flight[] = [];
  let particles: Particle[] = [];
  let raf = 0;
  let last = performance.now();

  const puff = (x: number, y: number, n: number) => {
    if (reduce) return;
    for (let i = 0; i < n; i++)
      particles.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 55 - 8, life: 0.5 + Math.random() * 0.5, age: 0 });
  };

  const setZone = (next: ZoneId | null) => {
    if (next === zone) return;
    zone = next;
    cb.onZone(next);
  };

  const goTile = (c: number, r: number, speed = WALK_SPEED) => {
    const cur: [number, number] = [Math.round(player.x), Math.round(player.y)];
    const start = player.path.length ? player.path[0] : cur;
    const path = findPath(start[0], start[1], c, r);
    if (!path) return;
    player.speed = speed;
    player.path = player.path.length ? [start, ...path] : path;
    if (!player.path.length) setZone(zoneAt(c, r));
  };

  const goZone = (k: ZoneId, fast = false) => {
    if (zoneAt(Math.round(player.x), Math.round(player.y)) === k && !player.path.length) {
      zone = null;
      setZone(k);
      return;
    }
    const [c, r] = ZONES[k].anchor;
    goTile(c, r, fast ? FAST_SPEED : WALK_SPEED);
  };

  const stepWalker = (w: Walker, dt: number) => {
    if (!w.path.length) {
      w.moving = false;
      return false;
    }
    const [tc, tr] = w.path[0];
    const dx = tc - w.x;
    const dy = tr - w.y;
    const d = Math.hypot(dx, dy);
    const s = w.speed * dt;
    w.moving = true;
    w.anim += dt;
    if (Math.abs(dy) > Math.abs(dx)) w.back = dy < 0;
    else if (dx) w.back = false;
    if (d <= s) {
      w.x = tc;
      w.y = tr;
      w.path.shift();
      if (!w.path.length) {
        w.moving = false;
        return true;
      }
    } else {
      w.x += (dx / d) * s;
      w.y += (dy / d) * s;
    }
    return false;
  };

  const drawDynamic = (now: number) => {
    // 바벨 + 이번 주 원판
    fill(g, 12, 40, 104, 2, "#9A9DA5");
    fill(g, 38, 38, 2, 6, "#C6C8CE");
    fill(g, 88, 38, 2, 6, "#C6C8CE");
    const count = Math.min(shownPlates, PLATE_ORDER.length);
    for (let i = 0; i < count; i++) {
      const h = PLATE_H[i];
      const y = 41 - (h >> 1);
      for (const x of [37 - (i + 1) * 3, 91 + i * 3]) {
        fill(g, x - 1, y - 1, 4, h + 2, C.ink);
        fill(g, x, y, 2, h, PLATE_ORDER[i].color);
      }
    }
    // 출석 체크기 화면
    if (!state.checked) {
      fill(g, 152, 323, 16, 10, now % 1000 < 500 ? "#3A3010" : "#4E4012");
      fill(g, 156, 326, 8, 5, C.yellow);
      fill(g, 158, 325, 3, 1, C.yellow);
      fill(g, 159, 327, 2, 2, "#3A3010");
    } else {
      fill(g, 152, 323, 16, 10, "#12301A");
      for (const [x, y] of [[154, 328], [156, 330], [158, 328], [160, 326], [162, 324]]) fill(g, x, y, 2, 2, C.green);
    }
  };

  const drawHighlight = (now: number) => {
    if (!zone) return;
    const [x, y, w, h] = ZONES[zone].box;
    const L = 5;
    g.globalAlpha = 0.55 + 0.45 * Math.sin(now / 160);
    for (const [px, py] of [[x, y], [x + w - L, y], [x, y + h - 1], [x + w - L, y + h - 1]]) fill(g, px, py, L, 1, C.yellow);
    for (const [px, py] of [[x, y], [x + w - 1, y], [x, y + h - L], [x + w - 1, y + h - L]]) fill(g, px, py, 1, L, C.yellow);
    g.globalAlpha = 1;
  };

  const marker = (x: number, y: number, col: string) => {
    fill(g, x, y, 7, 9, C.ink);
    fill(g, x + 1, y + 1, 5, 7, col);
    fill(g, x + 3, y + 2, 1, 3, C.ink);
    fill(g, x + 3, y + 6, 1, 1, C.ink);
    fill(g, x + 3, y + 9, 1, 1, C.ink);
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const arrived = stepWalker(player, dt);
    const here = zoneAt(Math.round(player.x), Math.round(player.y));
    if (player.moving && zone && here !== zone) setZone(null);
    if (arrived && here) setZone(here);

    g.drawImage(bg, 0, 0);
    drawDynamic(now);
    drawHighlight(now);
    if (!state.checked) marker(156, 300 + Math.round(Math.sin(now / 220) * 1.5), C.red);

    const px = Math.round(player.x * TILE + 3);
    const py = Math.round(player.y * TILE) - 1;
    const over = now < overUntil;
    const walkFrame = player.moving ? 1 + (Math.floor(player.anim * 12) % 2) : 0;
    const sitters = Math.min(3, Math.max(0, state.loungeCount));
    const actors: { y: number; draw: () => void }[] = [];
    for (let i = 0; i < sitters; i++) {
      const [sx, sy] = SEATS[i];
      actors.push({ y: sy + 16, draw: () => drawChar(g, sx, sy, GUESTS[i], { sit: true }) });
    }
    actors.push({
      y: py + 16.5,
      draw: () => {
        g.globalAlpha = 0.6;
        fill(g, px - 1, py + 15, 12, 2, C.yellow);
        fill(g, px + 1, py + 17, 8, 1, C.yellow);
        g.globalAlpha = 1;
        drawChar(g, px, py - (walkFrame === 1 ? 1 : 0), pal, { frame: over ? 0 : walkFrame, back: !over && player.back, over });
      },
    });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    flights = flights.filter((f) => {
      const p = Math.min(1, (now - f.t0) / f.dur);
      const e = 1 - Math.pow(1 - p, 2);
      const x = 160 + (30 - 160) * e;
      const y = 318 + (41 - 318) * e - Math.sin(Math.PI * p) * 70;
      const w = 2 + Math.round(Math.abs(Math.cos(p * 14)) * 9);
      fill(g, Math.round(x - w / 2) - 1, Math.round(y) - 8, w + 2, 16, C.ink);
      fill(g, Math.round(x - w / 2), Math.round(y) - 7, w, 14, C.red);
      if (p >= 1) {
        f.done();
        return false;
      }
      return true;
    });

    particles = particles.filter((q) => {
      q.age += dt;
      if (q.age >= q.life) return false;
      q.vy += 90 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const size = q.life > 0.8 ? 2 : 1;
      g.globalAlpha = 1 - q.age / q.life;
      fill(g, Math.round(q.x), Math.round(q.y), size, size, C.chalk);
      g.globalAlpha = 1;
      return true;
    });

    cb.onPlayer(px + 5, py - (over ? 11 : 3));
    raf = requestAnimationFrame(frame);
  };

  g.imageSmoothingEnabled = false;
  raf = requestAnimationFrame(frame);
  // 입구에서 몇 걸음 걸어 들어오며 시작
  const introTimer = window.setTimeout(() => goTile(7, 20), 450);

  return {
    setState(next) {
      const platesChanged = next.plates !== undefined && next.plates !== state.plates;
      state = { ...state, ...next };
      if (next.tone) pal = palOf(state.tone);
      if (platesChanged && !flights.length) shownPlates = state.plates;
    },
    tapAt(fx, fy) {
      let c = Math.floor((fx * MAP_W) / TILE);
      let r = Math.floor((fy * MAP_H) / TILE);
      const hit = OBJ.find((o) => o.zone && inRect(o, c, r));
      if (hit?.zone) return goZone(hit.zone);
      if (r < 2 && c >= 9 && c <= 14) return goZone("mirror");
      if (!walkable(c, r)) {
        const n = nearestWalkable(c, r);
        if (!n) return;
        [c, r] = n;
      }
      goTile(c, r);
    },
    goZone,
    step(dc, dr) {
      if (player.path.length) return;
      const c = Math.round(player.x) + dc;
      const r = Math.round(player.y) + dr;
      if (walkable(c, r)) {
        player.speed = WALK_SPEED;
        player.path = [[c, r]];
      }
    },
    celebrate() {
      // 출석 체크기 앞에서 원판이 날아가 바벨에 꽂히고, 캐릭터가 바벨을 든다
      shownPlates = Math.max(0, state.plates - 1);
      player.path = [];
      [player.x, player.y] = ZONES.checkin.anchor;
      overUntil = performance.now() + 1700;
      puff(player.x * TILE + 8, player.y * TILE + 2, 10);
      flights.push({
        t0: performance.now(),
        dur: reduce ? 10 : 680,
        done: () => {
          shownPlates = state.plates;
          puff(30, 41, 22);
          puff(98, 41, 22);
          cb.onPlateLanded();
        },
      });
    },
    clearZone() {
      zone = null;
    },
    destroy() {
      window.clearTimeout(introTimer);
      cancelAnimationFrame(raf);
    },
  };
}
