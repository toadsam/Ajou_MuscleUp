// 1층 밖 공간 — 헬스장 2층 · 야외 러닝 트랙 · 단백질 식당의 배경 그림과 막힌 칸.
//
// 지도 크기 · 칸은 1층과 같다(16×26칸, 한 칸 16px). 1층 입구 매트(포탈)에서 들어오고,
// 아래 가운데 출구(계단 · 문 · 문)에 서면 1층으로 돌아간다. 꾸미기 자리는 decor.ts(scene 별).
// 직원 · 라운지 손님 · 원판 · 출석 표시는 1층에만 있다.
import type { SceneId } from "./decor";
import type { ThemePal } from "./engine";

type Rect = { c: number; r: number; w: number; h: number };
type G = CanvasRenderingContext2D;

export type SceneSpec = {
  /** 화면에 보이는 이름 */
  name: string;
  /** 출구 이름표 */
  exitName: string;
  /** 고정 시설(못 지나감) */
  objs: Rect[];
  /** 들어왔을 때 서는 칸 */
  start: [number, number];
  /** 여기 서면 1층으로 */
  exit: Rect;
  paint: (g: G, theme: ThemePal) => void;
};

const W = 256;
const H = 416;
const INK = "#0E0E10";
const CHALK = "#F3F1EA";
const YELLOW = "#F0BE2E";

const fill = (g: G, x: number, y: number, w: number, h: number, c: string) => {
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

/** 아래 가운데 출구 표시(노랑 · 검정 줄) */
function exitMat(g: G, label: "stairs" | "gate" | "door") {
  fill(g, 96, 384, 64, 16, label === "gate" ? "#3A2A1E" : "#18181A");
  for (let x = 96; x < 160; x += 4) fill(g, x, 384, 2, 2, YELLOW);
  if (label === "stairs") {
    // 내려가는 계단
    for (let i = 0; i < 4; i++) {
      fill(g, 100 + i * 2, 388 + i * 3, 56 - i * 4, 3, i % 2 ? "#3B3D44" : "#4A4C53");
      fill(g, 100 + i * 2, 388 + i * 3, 56 - i * 4, 1, "#6B6E76");
    }
  }
}

/* ---------- 2층: 스트레칭 · 꾸미기 층 ---------- */

function paintFloor2(g: G, t: ThemePal) {
  const rnd = rng(21);
  fill(g, 0, 0, W, H, t.floor);
  if (t.pattern === "planks") {
    for (let y = 32, row = 0; y < H - 16; y += 8, row++) {
      fill(g, 16, y, W - 32, 1, t.seam);
      for (let x = 16 + ((row * 24) % 48); x < W - 16; x += 48) fill(g, x, y, 1, 8, t.seam);
    }
  } else if (t.pattern === "slabs") {
    for (let y = 32; y < H - 16; y += 64) fill(g, 16, y, W - 32, 1, t.seam);
    for (let x = 16; x < W - 16; x += 64) fill(g, x, 32, 1, H - 48, t.seam);
  } else {
    for (let r = 2; r < 25; r += 2) fill(g, 16, r * 16, W - 32, 1, t.seam);
    for (let c = 1; c < 15; c += 2) fill(g, c * 16, 32, 1, H - 48, t.seam);
  }
  for (let i = 0; i < 420; i++) fill(g, 16 + ((rnd() * (W - 32)) | 0), 32 + ((rnd() * (H - 48)) | 0), 1, 1, rnd() < 0.5 ? t.specks[0] : t.specks[1]);
  // 가운데 스트레칭 존(초록 고무 매트)
  fill(g, 96, 112, 64, 120, "#26332B");
  fill(g, 96, 112, 64, 1, "#3C5244");
  fill(g, 96, 231, 64, 1, "#3C5244");
  for (let y = 124; y < 228; y += 18) fill(g, 104, y, 48, 1, "#2E3E34");
  // 벽 · 창문
  fill(g, 0, 0, W, 32, t.wall);
  fill(g, 0, 0, W, 5, "#151517");
  if (t.brick) {
    for (let y = 5, row = 0; y < 31; y += 6, row++) {
      fill(g, 0, y, W, 1, t.brick.mortar);
      for (let x = row % 2 ? 8 : 0; x < W; x += 16) fill(g, x, y, 1, 6, t.brick.mortar);
    }
  }
  fill(g, 92, 6, 72, 24, INK);
  fill(g, 94, 8, 68, 20, "#7FB3DE");
  fill(g, 94, 20, 68, 8, "#A9CCEA");
  fill(g, 127, 8, 2, 20, INK);
  for (let i = 0; i < 4; i++) fill(g, 100 + i * 14, 22 - (i % 2) * 3, 6, 3, CHALK);
  fill(g, 0, 31, W, 1, INK);
  fill(g, 0, 32, 16, H - 48, t.side);
  fill(g, 15, 32, 1, H - 48, INK);
  fill(g, W - 16, 32, 16, H - 48, t.side);
  fill(g, W - 16, 32, 1, H - 48, INK);
  fill(g, 0, H - 16, W, 16, "#151517");
  fill(g, 0, H - 16, W, 1, INK);
  // 정수기(고정)
  fill(g, 225, 135, 14, 26, INK);
  fill(g, 226, 148, 12, 12, "#D9D7CF");
  fill(g, 228, 136, 8, 12, "#6FA8DC");
  fill(g, 230, 152, 2, 2, "#D9302A");
  exitMat(g, "stairs");
}

/* ---------- 야외 러닝 트랙 ---------- */

/** 세로로 긴 경기장 모양 */
function stadium(g: G, x0: number, y0: number, x1: number, y1: number) {
  const r = (x1 - x0) / 2;
  const cx = x0 + r;
  g.beginPath();
  g.moveTo(x0, y0 + r);
  g.arc(cx, y0 + r, r, Math.PI, 0);
  g.lineTo(x1, y1 - r);
  g.arc(cx, y1 - r, r, 0, Math.PI);
  g.closePath();
}

function paintTrack(g: G) {
  const rnd = rng(37);
  fill(g, 0, 0, W, H, "#3D7A3A");
  for (let i = 0; i < 700; i++) fill(g, (rnd() * W) | 0, (rnd() * H) | 0, 1, 2, rnd() < 0.5 ? "#357034" : "#4A8A45");
  // 트랙(바깥 → 안쪽 잔디)
  g.save();
  g.fillStyle = "#B04A36";
  stadium(g, 24, 36, 232, 396);
  g.fill();
  g.strokeStyle = CHALK;
  g.lineWidth = 1;
  for (const d of [9, 18]) {
    stadium(g, 24 + d, 36 + d, 232 - d, 396 - d);
    g.stroke();
  }
  g.fillStyle = "#4C8C46";
  stadium(g, 52, 64, 204, 368);
  g.fill();
  g.restore();
  for (let i = 0; i < 260; i++) {
    const x = 60 + ((rnd() * 136) | 0);
    const y = 140 + ((rnd() * 150) | 0);
    fill(g, x, y, 1, 2, rnd() < 0.5 ? "#438240" : "#58994F");
  }
  // 위쪽 나무 줄(못 지나감)
  fill(g, 0, 0, W, 30, "#24552A");
  for (let x = -6; x < W; x += 22) {
    fill(g, x, 4, 24, 22, INK);
    fill(g, x + 1, 5, 22, 20, "#2E6B34");
    fill(g, x + 4, 7, 8, 6, "#3F8746");
  }
  fill(g, 0, 29, W, 2, INK);
  // 양옆 · 아래 울타리
  for (const x of [0, W - 16]) {
    fill(g, x, 32, 16, H - 48, "#3A6B37");
    for (let y = 40; y < H - 16; y += 16) fill(g, x + 6, y, 4, 10, "#C9B48A");
    fill(g, x + 2, 32, 12, 2, "#C9B48A");
  }
  fill(g, 0, H - 16, W, 16, "#2C5A2B");
  for (let x = 4; x < W; x += 12) fill(g, x, H - 14, 4, 12, "#C9B48A");
  fill(g, 0, H - 10, W, 2, "#C9B48A");
  fill(g, 104, H - 16, 48, 16, "#3A2A1E");
  exitMat(g, "gate");
}

/* ---------- 단백질 식당 ---------- */

function paintDiner(g: G) {
  // 바닥: 크림 · 베이지 체크 타일
  for (let r = 0; r < 26; r++)
    for (let c = 0; c < 16; c++) fill(g, c * 16, r * 16, 16, 16, (r + c) % 2 ? "#D8CDB2" : "#E6DDC6");
  // 벽 · 타일 백스플래시
  fill(g, 0, 0, W, 32, "#7A3B2E");
  fill(g, 0, 0, W, 5, "#151517");
  fill(g, 0, 14, W, 18, "#E9E4D8");
  for (let x = 0; x < W; x += 8) fill(g, x, 14, 1, 18, "#CFC8B8");
  for (let y = 14; y < 32; y += 6) fill(g, 0, y, W, 1, "#CFC8B8");
  // 조리대(고정)
  fill(g, 16, 40, W - 32, 24, INK);
  fill(g, 17, 41, W - 34, 6, "#D8D3C6");
  fill(g, 17, 47, W - 34, 16, "#8A8D94");
  for (let x = 48; x < W - 16; x += 32) fill(g, x, 47, 1, 16, "#6B6E76");
  // 옆벽 · 아래 벽
  fill(g, 0, 32, 16, H - 48, "#6A3226");
  fill(g, 15, 32, 1, H - 48, INK);
  fill(g, W - 16, 32, 16, H - 48, "#6A3226");
  fill(g, W - 16, 32, 1, H - 48, INK);
  fill(g, 0, H - 16, W, 16, "#151517");
  fill(g, 0, H - 16, W, 1, INK);
  // 식탁 넷 + 의자
  for (const [c, r] of [[3, 9], [10, 9], [3, 15], [10, 15]]) {
    const x = c * 16;
    const y = r * 16;
    fill(g, x, y + 2, 48, 26, INK);
    fill(g, x + 1, y + 3, 46, 22, "#A8743F");
    fill(g, x + 1, y + 3, 46, 2, "#C48E55");
    fill(g, x + 6, y + 8, 10, 6, CHALK);
    fill(g, x + 30, y + 14, 10, 6, CHALK);
    fill(g, x + 9, y + 9, 4, 3, "#E35D3A");
    fill(g, x + 33, y + 15, 4, 3, "#7FBF5A");
    for (const sx of [x - 10, x + 50]) {
      fill(g, sx, y + 8, 8, 10, INK);
      fill(g, sx + 1, y + 9, 6, 8, "#2F6FD0");
    }
  }
  exitMat(g, "door");
}

export const SCENES: Record<Exclude<SceneId, "MAIN">, SceneSpec> = {
  FLOOR2: {
    name: "헬스장 2층",
    exitName: "계단 · 1층으로",
    objs: [{ c: 14, r: 8, w: 1, h: 2 }],
    start: [7, 22],
    exit: { c: 6, r: 24, w: 4, h: 1 },
    paint: paintFloor2,
  },
  TRACK: {
    name: "야외 러닝 트랙",
    exitName: "헬스장으로",
    objs: [],
    start: [7, 22],
    exit: { c: 6, r: 24, w: 4, h: 1 },
    paint: (g) => paintTrack(g),
  },
  DINER: {
    name: "단백질 식당",
    exitName: "헬스장으로",
    objs: [
      { c: 1, r: 2, w: 14, h: 2 },
      { c: 3, r: 9, w: 3, h: 2 },
      { c: 10, r: 9, w: 3, h: 2 },
      { c: 3, r: 15, w: 3, h: 2 },
      { c: 10, r: 15, w: 3, h: 2 },
    ],
    start: [7, 22],
    exit: { c: 6, r: 24, w: 4, h: 1 },
    paint: (g) => paintDiner(g),
  },
};
