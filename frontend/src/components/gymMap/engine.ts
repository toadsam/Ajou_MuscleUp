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
//   decor       꾸미기 자리마다 놓은 물품(decor.ts). 바뀌면 배경을 다시 그리고, 놓인 물품 칸은 못 지나간다.
//   decorEdit   꾸미기 중이면 자리마다 노란 점선 테두리, decorPick 은 고른 자리(깜빡임).
//   scene       지금 공간(1층 MAIN · 2층 · 러닝 트랙 · 식당 — scenes.ts). 1층 입구 매트(portal)에 서면 고르는 창, 다른 공간 출구(exit)에 서면 1층으로.
//               직원 · 라운지 손님 · 원판 · 출석 표시는 1층에만 그린다.
//   decor.THEME 바닥 · 벽 테마(THEMES, 1층 · 2층). decor 의 유니폼 · 머리색 · 새 직원 출근(staffLookOf) → 직원 NPC 모습과 인원.

import { PLATE_ORDER } from "../gym/plates";
import { temperament } from "../avatar/mbti";
import {
  DEFAULT_LAYOUT,
  SLOTS,
  SLOT_IDS,
  paintDecor,
  solidTiles,
  staffLookOf,
  type DecorLayout,
  type SceneId,
  type SlotId,
  type StaffId,
  type StaffLook,
} from "./decor";
import { SCENES } from "./scenes";

export const TILE = 16;
export const COLS = 16;
export const ROWS = 26;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

export type ZoneId = "checkin" | "rack" | "mirror" | "board" | "lounge" | "crew" | "community";
/** 장소 + 1층 입구 포탈 · 다른 공간 출구 */
export type MapZone = ZoneId | "portal" | "exit";
/** 1층 입구 매트: 여기 서면 다른 공간으로 가는 창 */
export const PORTAL: { trig: { c: number; r: number; w: number; h: number }; label: [number, number] } = {
  trig: { c: 6, r: 23, w: 3, h: 2 },
  label: [8, 23.2],
};
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
  crew: { name: "러닝머신", page: "운동 모임", trig: { c: 9, r: 18, w: 6, h: 2 }, anchor: [11, 18], label: [12, 15.5], box: [142, 254, 100, 36] },
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
];

const START: [number, number] = [7, 24];
/** 다른 공간에서 돌아오면 입구 매트 바로 위(매트 위면 다시 창이 뜬다) */
const PORTAL_RETURN: [number, number] = [7, 21];
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
  if (temperament(v) === "NT") return { skin: "#f3c7a9", tank: "#2F6FD0", hair: "#1e293b" };
  if (temperament(v) === "NF") return { skin: "#f4c8b4", tank: "#F0BE2E", hair: "#3f3f46" };
  if (temperament(v) === "SJ") return { skin: "#edc2a5", tank: "#2E9C55", hair: "#292524" };
  if (temperament(v) === "SP") return { skin: "#f1c6aa", tank: "#D9302A", hair: "#1f2937" };
  return { skin: "#E8B98F", tank: "#D9302A", hair: "#2B2420" };
}

/**
 * 작은 그림의 사람마다 다른 모양 — 큰 카드 그림(chibiArt)과 같은 값에서 온다(avatar/spriteShape.ts).
 * hair 머리 모양(시드 0..), female 여자(긴 머리 · 똥머리), stage 몸 단계 0~5, band 머리띠 색(티어 다이아 이상)
 */
export type SpriteShape = { hair: number; female: boolean; stage: number; band?: string | null };
/** h 머리 · s 피부 · k 눈(잉크) · r 민소매 · b 반바지 · w 흰색(신발 · 눈 반짝임) · p 볼(없으면 피부색) · shape 사람마다 다른 모양(없으면 기본) */
export type Pal = Record<"h" | "s" | "k" | "r" | "b" | "w", string> & { p?: string; shape?: SpriteShape | null };
export const BLUSH = "#EE9C86";
export const palOf = (t: Tone, shape?: SpriteShape | null): Pal => ({ h: t.hair, s: t.skin, k: C.ink, r: t.tank, b: "#2C2D31", w: C.chalk, p: BLUSH, shape: shape ?? null });
const GUESTS: Pal[] = [
  { h: "#5A3A22", s: "#F0C7A0", k: C.ink, r: C.blue, b: "#2C2D31", w: C.chalk, p: BLUSH },
  { h: "#16161A", s: "#D9A577", k: C.ink, r: C.yellow, b: "#2C2D31", w: C.chalk, p: BLUSH },
  { h: "#7A4A2A", s: "#EDBD95", k: C.ink, r: C.green, b: "#3B3D44", w: C.chalk, p: BLUSH },
];
/* ---------- 헬스장 직원 NPC ----------
   실제 회원과 헷갈리지 않게: 모두 같은 조끼 유니폼(색은 꾸미기에서 고름), 이름표는 역할(코치 · 관장님 · 직원 …)만.
   닉네임 · 레벨은 없다. 실제 접속자는 라운지 벤치에 앉는 사람(인원 수 = 실시간 라운지 인원)뿐이다.
   트레이너 · 청소 알바 · 수건 알바는 꾸미기에서 기록으로 얻어 "출근"시킨 사람에게만 나온다.
   러닝 코치(트랙) · 영양사(식당)는 그 공간에만 늘 있다. */
export type NpcId = StaffId | "runcoach" | "dietitian";
export const NPC_ROLES: Record<NpcId, string> = {
  coach: "코치", owner: "관장님", staff: "직원", trainer: "트레이너", cleaner: "청소 알바", towel: "수건 알바",
  runcoach: "러닝 코치", dietitian: "영양사",
};
/** 1층 밖 공간에 있는 직원(1층은 늘 있는 셋 + 출근한 새 직원) */
export const SCENE_NPCS: Record<Exclude<SceneId, "MAIN">, NpcId[]> = { FLOOR2: [], TRACK: ["runcoach"], DINER: ["dietitian"] };
const EXTRA_HAIR: Partial<Record<NpcId, string>> = { runcoach: "#2B2420", dietitian: "#5A3A22" };
/** 늘 있는 직원 */
const BASE_NPCS: NpcId[] = ["coach", "owner", "staff"];
const NPC_SKIN: Record<NpcId, string> = {
  coach: "#D9A577", owner: "#E7B48C", staff: "#F0C7A0", trainer: "#E8B98F", cleaner: "#EDBD95", towel: "#F1C6AA",
  runcoach: "#D9A577", dietitian: "#F0C7A0",
};
const npcPal = (id: NpcId, look: StaffLook): Pal => ({
  h: look.hair[id as StaffId] ?? EXTRA_HAIR[id] ?? "#1B1B1F",
  s: NPC_SKIN[id],
  k: C.ink,
  p: BLUSH,
  // 영양사는 흰 가운, 나머지는 헬스장 조끼
  r: id === "dietitian" ? "#E4E2DA" : look.uniform,
  b: "#1C1D20",
  w: C.chalk,
});
type NpcPlan =
  | { kind: "wander"; area: Rect; pause: [number, number] }
  | { kind: "route"; points: [number, number][]; pause: [number, number] };
const NPC_PLANS: Record<NpcId, { start: [number, number]; speed: number; plan: NpcPlan }> = {
  // 코치: 플랫폼과 가운데 바닥을 돌아다닌다
  coach: { start: [5, 6], speed: 2.4, plan: { kind: "wander", area: { c: 1, r: 4, w: 8, h: 11 }, pause: [1.5, 4] } },
  // 관장님: 카운터 옆에 서 있다가 가끔 둘러본다
  owner: { start: [6, 22], speed: 1.8, plan: { kind: "route", points: [[6, 22], [7, 19], [6, 22], [3, 20]], pause: [4, 8] } },
  // 직원: 아래쪽 바닥을 걸레질하며 돈다
  staff: { start: [5, 15], speed: 1.4, plan: { kind: "route", points: [[5, 15], [8, 15], [8, 20], [5, 20]], pause: [0.6, 1.4] } },
  // 트레이너: 가운데 바닥을 오가며 자세를 봐 준다
  trainer: { start: [6, 9], speed: 2, plan: { kind: "wander", area: { c: 5, r: 7, w: 4, h: 8 }, pause: [2, 5] } },
  // 청소 알바: 라운지 아래 · 러닝머신 앞을 닦으며 돈다
  cleaner: { start: [9, 14], speed: 1.3, plan: { kind: "route", points: [[9, 14], [14, 14], [14, 15], [9, 15]], pause: [0.8, 1.8] } },
  // 수건 알바: 출석 체크기 옆에서 수건을 건넨다
  towel: { start: [11, 23], speed: 1.6, plan: { kind: "route", points: [[11, 23], [12, 22], [11, 23], [8, 22]], pause: [3, 6] } },
  // 러닝 코치: 트랙을 한 바퀴씩 뛴다
  runcoach: {
    start: [2, 12],
    speed: 3.6,
    plan: { kind: "route", points: [[2, 18], [4, 22], [7, 23], [11, 22], [13, 18], [13, 8], [11, 3], [7, 2], [4, 3], [2, 8]], pause: [0.1, 0.4] },
  },
  // 영양사: 조리대 앞을 오가며 식단을 봐 준다
  dietitian: { start: [5, 5], speed: 1.4, plan: { kind: "route", points: [[5, 5], [11, 5], [11, 6], [5, 6]], pause: [1.5, 3.5] } },
};

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

const buildSolid = (objs: Rect[]) => {
  const grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (r < 2 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? 1 : 0)),
  );
  objs.forEach((o) => {
    for (let r = o.r; r < o.r + o.h; r++) for (let c = o.c; c < o.c + o.w; c++) grid[r][c] = 1;
  });
  return grid;
};
/** 지금 공간의 막힌 칸 · 공간. 지도는 한 화면에 하나뿐이라 모듈에 둔다 */
let solid = buildSolid(OBJ);
let currentScene: SceneId = "MAIN";
const setScene = (scene: SceneId) => {
  currentScene = scene;
  solid = buildSolid(scene === "MAIN" ? OBJ : SCENES[scene].objs);
};
/** 꾸미기 물품이 놓여 막힌 칸(r * COLS + c). 지도는 한 화면에 하나뿐이라 모듈에 둔다 */
let decorSolid = new Set<number>();
const setDecorSolid = (layout: DecorLayout) => {
  const next = new Set<number>();
  for (const q of solidTiles(layout, currentScene)) for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) next.add(r * COLS + c);
  decorSolid = next;
};
const walkable = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !solid[r][c] && !decorSolid.has(r * COLS + c);
const inRect = (q: Rect, c: number, r: number) => c >= q.c && c < q.c + q.w && r >= q.r && r < q.r + q.h;
export function zoneAt(c: number, r: number): MapZone | null {
  if (currentScene !== "MAIN") return inRect(SCENES[currentScene].exit, c, r) ? "exit" : null;
  return ZONE_IDS.find((k) => inRect(ZONES[k].trig, c, r)) ?? (inRect(PORTAL.trig, c, r) ? "portal" : null);
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

/** 바닥 · 벽 테마(꾸미기). 고무 매트가 원래 모습 */
export type ThemePal = {
  floor: string;
  seam: string;
  specks: [string, string];
  wall: string;
  wallLine: string;
  side: string;
  pattern: "tiles" | "planks" | "slabs";
  brick?: { face: string; mortar: string };
};
export const THEMES: Record<string, ThemePal> = {
  THEME_RUBBER: { floor: C.floor, seam: C.seam, specks: [C.speck, "#1E1F22"], wall: C.wallFace, wallLine: "#2A2C31", side: "#2A2B30", pattern: "tiles" },
  THEME_MAPLE: { floor: "#6B4A2E", seam: "#563A22", specks: ["#77543A", "#5F4128"], wall: "#3B3833", wallLine: "#2F2C28", side: "#33302B", pattern: "planks" },
  THEME_CONCRETE: { floor: "#55575B", seam: "#46484C", specks: ["#62646A", "#4B4D51"], wall: "#43454A", wallLine: "#383A3F", side: "#3D3F44", pattern: "slabs" },
  THEME_BRICK: {
    floor: "#25211E", seam: "#1C1916", specks: ["#2E2925", "#1F1B18"], wall: "#7A3428", wallLine: "#4A2018", side: "#5E2A21", pattern: "tiles",
    brick: { face: "#7A3428", mortar: "#4A2018" },
  },
};

function paintStatic(g: CanvasRenderingContext2D, theme: ThemePal = THEMES.THEME_RUBBER) {
  const rnd = rng(11);
  const W = MAP_W;
  const H = MAP_H;
  fill(g, 0, 0, W, H, theme.floor);
  if (theme.pattern === "planks") {
    // 나무 판자: 가로 8px 줄 + 엇갈린 이음매
    for (let y = 32, row = 0; y < H - 16; y += 8, row++) {
      fill(g, 16, y, W - 32, 1, theme.seam);
      for (let x = 16 + ((row * 24) % 48); x < W - 16; x += 48) fill(g, x, y, 1, 8, theme.seam);
    }
  } else if (theme.pattern === "slabs") {
    // 콘크리트 판: 64px 줄눈 + 초크 자국
    for (let y = 32; y < H - 16; y += 64) fill(g, 16, y, W - 32, 1, theme.seam);
    for (let x = 16; x < W - 16; x += 64) fill(g, x, 32, 1, H - 48, theme.seam);
  } else {
    for (let r = 2; r < 25; r += 2) fill(g, 16, r * TILE, W - 32, 1, theme.seam);
    for (let c = 1; c < 15; c += 2) fill(g, c * TILE, 32, 1, H - 48, theme.seam);
  }
  for (let i = 0; i < 520; i++) fill(g, 16 + ((rnd() * (W - 32)) | 0), 32 + ((rnd() * (H - 48)) | 0), 1, 1, rnd() < 0.5 ? theme.specks[0] : theme.specks[1]);
  if (theme.pattern === "slabs") {
    const chalk = rng(29);
    for (let i = 0; i < 9; i++) {
      const x = 24 + ((chalk() * (W - 64)) | 0);
      const y = 140 + ((chalk() * (H - 200)) | 0);
      g.globalAlpha = 0.35;
      fill(g, x, y, 4 + ((chalk() * 6) | 0), 2, C.chalk);
      g.globalAlpha = 1;
    }
  }
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
  // 바닥 원판 무늬 · 화분은 꾸미기 물품(decor.ts)으로 옮겼다
  // 벽
  fill(g, 0, 0, W, 32, theme.wall);
  fill(g, 0, 0, W, 5, C.wallCap);
  if (theme.brick) {
    // 벽돌: 6px 줄, 16px 벽돌을 엇갈리게
    for (let y = 5, row = 0; y < 31; y += 6, row++) {
      fill(g, 0, y, W, 1, theme.brick.mortar);
      for (let x = row % 2 ? 8 : 0; x < W; x += 16) fill(g, x, y, 1, 6, theme.brick.mortar);
    }
  } else {
    fill(g, 0, 18, W, 1, theme.wallLine);
    for (let x = 0; x < W; x += 32) {
      fill(g, x, 5, 1, 27, theme.wallLine);
      for (const [dx, dy] of [[3, 8], [28, 8], [3, 28], [28, 28]]) fill(g, x + dx, dy, 1, 1, C.rivet);
    }
  }
  fill(g, 0, 31, W, 1, C.ink);
  fill(g, 0, 32, 16, H - 48, theme.side);
  fill(g, 15, 32, 1, H - 48, C.ink);
  fill(g, W - 16, 32, 16, H - 48, theme.side);
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
}

/** 꾸미기 창: 테마 미리보기(벽 · 바닥 · 플랫폼 모서리가 보이는 부분) */
export function paintThemePreview(canvas: HTMLCanvasElement, theme: string) {
  const full = document.createElement("canvas");
  full.width = MAP_W;
  full.height = MAP_H;
  const fg = full.getContext("2d");
  const g = canvas.getContext("2d");
  if (!fg || !g) return;
  paintStatic(fg, THEMES[theme] ?? THEMES.THEME_RUBBER);
  canvas.width = 64;
  canvas.height = 54;
  g.imageSmoothingEnabled = false;
  g.drawImage(full, 88, 0, 64, 54, 0, 0, 64, 54);
}

/** 포탈 창: 공간 미리보기(그 공간 지도 가운데를 잘라서) */
export function paintScenePreview(canvas: HTMLCanvasElement, scene: Exclude<SceneId, "MAIN">, themeCode?: string | null) {
  const full = document.createElement("canvas");
  full.width = MAP_W;
  full.height = MAP_H;
  const fg = full.getContext("2d");
  const g = canvas.getContext("2d");
  if (!fg || !g) return;
  SCENES[scene].paint(fg, THEMES[themeCode ?? ""] ?? THEMES.THEME_RUBBER);
  canvas.width = 104;
  canvas.height = 88;
  g.imageSmoothingEnabled = false;
  g.drawImage(full, 76, scene === "DINER" ? 120 : 0, 104, 88, 0, 0, 104, 88);
}

/* ---------- 캐릭터 (10×16 픽셀, 2026-10-20 치비) ----------
   큰 카드 그림(chibiArt)과 같은 비율: 머리 8줄(키의 절반) · 큰 눈 2×2(반짝임 한 칸) · 볼 · 짧은 몸 4줄 · 다리 4줄.
   글자: h 머리 · s 피부 · k 눈 · w 흰색 · p 볼 · r 민소매 · b 반바지 · d 머리띠. 외곽선은 잉크로 한 칸 둘러 그린다.
   사람마다(pal.shape): 머리 모양 4가지(기본 · 삐죽 · 높은 앞머리 · 옆으로 넘긴 앞머리), 여자는 긴 머리 · 똥머리,
   몸 단계 0 마른 몸 → 1 · 2~3 어깨 · 팔이 몸 밖으로 → 4~5 한 칸씩 더 넓은 어깨(12칸), 티어 다이아 이상 머리띠. */

const HEAD = [
  "..hhhhhh..",
  ".hhhhhhhh.",
  "hhhhhhhhhh",
  "hhsshssshh",
  "hskwsskwsh",
  "hskksskksh",
  ".pssssssp.",
  "..ssssss..",
];
/** 뒷모습: 얼굴 자리를 머리카락으로, 목덜미만 피부 */
const BACK = { 3: "hhhhhhhhhh", 4: "hhhhhhhhhh", 5: "hhhhhhhhhh", 6: ".hhhhhhhh.", 7: "..ssssss.." } as Record<number, string>;
/** 몸통 4줄 [왼쪽 칸 차이, 줄] — 몸 단계별 */
const BODY: Record<"thin" | "base" | "broad" | "huge", [number, string][]> = {
  thin: [[0, "..srrrrs.."], [0, "..srrrrs.."], [0, "..s.rr.s.."], [0, "..bbbbbb.."]],
  base: [[0, ".srrrrrrs."], [0, ".srrrrrrs."], [0, ".s.rrrr.s."], [0, "..bbbbbb.."]],
  broad: [[0, "ssrrrrrrss"], [0, "ssrrrrrrss"], [0, "ss.rrrr.ss"], [0, "..bbbbbb.."]],
  huge: [[-1, "sssrrrrrrsss"], [-1, "sssrrrrrrsss"], [-1, "ss.srrrrs.ss"], [-1, "ss.bbbbbb.ss"]],
};
const LEGS = [
  ["..bb..bb..", "..ss..ss..", "..ss..ss..", "..ww..ww.."],
  ["..bb..bb..", "..ss..ss..", "..ww..ss..", "......ww.."],
  ["..bb..bb..", "..ss..ss..", "..ss..ww..", "..ww......"],
];
/**
 * frame 다리(0 서기 · 1 · 2 걷기) · sit 앉기 · back 뒷모습 · over 머리 위 바
 * hop 몸 전체를 위로(통통 걷기) · squash 머리를 한 칸 내려 어깨에 묻는다(착지 · 숨 내쉬기)
 * pose 자세(팔을 따로 그린다) · poseFrame 자세의 두 장면(0 · 1 번갈아)
 */
export type CharOpts = { frame?: number; sit?: boolean; back?: boolean; over?: boolean; hop?: number; squash?: boolean; pose?: SpritePose | null; poseFrame?: number };

/**
 * 작은 그림 자세(2026-10-20)
 *  라운지 이모트: wave 인사(오른손 흔들기) · cheer 화이팅(두 주먹 위로) · clap 박수(두 손 모으기) · gg 꾸벅(고개 숙이기)
 *  홈 지도 기구: squat 파워랙(바를 메고 앉았다 일어나기) · flex 거울(알통 자세, 알통이 부풀었다 줄었다)
 */
export type SpritePose = "wave" | "cheer" | "clap" | "gg" | "squat" | "flex";

/** 자세별 왼팔 칸 [x, y](오른팔은 9 - x 로 거울). wave 는 오른팔만 */
function poseArms(pose: SpritePose, f: number): [number, number][] {
  const left = (cells: [number, number][]) => [...cells, ...cells.map(([x, y]) => [9 - x, y] as [number, number])];
  switch (pose) {
    case "wave":
      // 오른손을 머리 옆으로 들어 좌우로 흔든다
      return [[9, 8], [9, 7], [10, 6], [10, 5], [10, 4], [10, 3], ...(f ? ([[11, 2], [11, 1]] as [number, number][]) : ([[10, 2], [10, 1]] as [number, number][]))];
    case "cheer": {
      // 두 주먹을 머리 옆 → 머리 위로
      const top = f ? 0 : 3;
      const arm: [number, number][] = [[0, 8]];
      for (let yy = 7; yy > top; yy -= 1) arm.push([-1, yy]);
      return left([...arm, [-1, top], [-1, top - 1]]);
    }
    case "clap":
      // 벌렸다 → 가슴 앞에서 손을 모은다
      return left(f ? [[1, 8], [2, 9], [3, 9], [4, 9]] : [[1, 8], [1, 9], [1, 10], [2, 10]]);
    case "flex":
      // 더블 바이셉스: 위팔은 옆으로, 팔뚝은 위로, 주먹은 머리 옆. 장면 1 은 알통이 한 칸 더 솟는다
      return left([[0, 8], [-1, 8], [-2, 8], [-2, 7], [-2, 6], [-2, 5], [-3, 4], [-2, 4], [-1, 7], ...(f ? ([[-1, 6]] as [number, number][]) : [])]);
    case "squat":
      // 목 뒤 바를 두 손으로 쥔다
      return left([[0, 8], [-1, 8], [-1, 7], [-1, 6]]);
    default:
      return [];
  }
}
const SQUAT_LEGS = [".sb....bs.", "ww......ww"];

/**
 * 작은 그림의 움직임(2026-10-20) — 치비답게 통통.
 * 걷기: cycle(걸음 수 같은 연속 값)을 4박자로 나눠 다리 1 · 1 · 2 · 2, 박자마다 뜸(hop 1) → 착지(머리가 한 박자 늦게 내려앉음).
 * 서기: 1.6초마다 0.35초 머리가 한 칸 내려앉는 숨쉬기. seed 로 사람마다 박자를 어긋나게.
 */
export function walkPose(cycle: number, moving: boolean, now: number, seed = 0): { frame: number; hop: number; squash: boolean } {
  if (moving) {
    const phase = Math.floor(cycle * 2) % 4;
    return { frame: phase < 2 ? 1 : 2, hop: phase % 2 === 0 ? 1 : 0, squash: phase % 2 === 1 };
  }
  const t = (now / 1000 + seed * 0.37) % 1.6;
  return { frame: 0, hop: 0, squash: t > 1.25 };
}

/** 그릴 칸 목록 [x, y, 글자](x · y 는 왼쪽 위 기준, 위로 솟는 머리는 y < 0) */
function charCells(o: CharOpts, sh: SpriteShape | null | undefined): [number, number, string][] {
  const stage = sh?.stage ?? 1;
  const hair = Math.abs(Math.round(sh?.hair ?? 0)) % 4;
  const female = sh?.female ?? false;
  const head = HEAD.slice();
  if (o.back) Object.entries(BACK).forEach(([i, row]) => (head[Number(i)] = row));
  if (!female && hair === 3 && !o.back) head[3] = "hhhhhsshhh"; // 옆으로 넘긴 앞머리
  if (female && hair % 2 === 0) {
    // 긴 머리: 볼 옆으로 내려온다
    head[6] = o.back ? ".hhhhhhhh." : "hpssssssph";
    head[7] = o.back ? ".hhhhhhhh." : "h.ssssss.h";
  }
  if (sh?.band) head[2] = "dddddddddd";
  const rows: [number, number, string][] = head.map((row, i) => [i, 0, row]);
  const headRows: [number, number, string][] = [];
  if (female && hair % 2 === 1) headRows.push([-3, 0, "....hh...."], [-2, 0, "...hhhh..."], [-1, 0, "....hh...."]); // 똥머리(둥근 공 + 묶은 자리)
  else if (!female && hair === 1) headRows.push([-1, 0, ".h..h.h.h."]); // 삐죽 머리
  else if (!female && hair === 2) headRows.push([-1, 0, "..hhhhh..."]); // 높은 앞머리
  rows.push(...headRows);
  const pose = o.pose ?? null;
  const f = o.poseFrame ?? 0;
  // 꾸벅(gg 장면 1)은 머리를 두 칸, 착지 · 숨쉬기는 한 칸 내려앉힌다
  const sink = pose === "gg" && f === 1 ? 2 : o.squash ? 1 : 0;
  if (sink) rows.forEach((r) => (r[0] += sink));
  const body = stage <= 0 ? BODY.thin : stage <= 1 ? BODY.base : stage <= 3 ? BODY.broad : BODY.huge;
  // 자세가 있으면 옆 팔(몸통 밖 피부 칸)을 지우고 아래에서 자세 팔을 따로 그린다(꾸벅은 팔 그대로, 인사는 오른팔만)
  const clearArm = (dx: number, row: string) =>
    !pose || pose === "gg"
      ? row
      : [...row].map((ch, i) => (ch === "s" && ((pose !== "wave" && dx + i < 2) || dx + i > 7) ? "." : ch)).join("");
  body.forEach(([dx, row], i) => rows.push([8 + i, dx, clearArm(dx, row)]));
  const squatDown = pose === "squat" && f === 1;
  if (squatDown) rows.forEach((r) => (r[0] += 2)); // 앉으면 몸이 두 칸 내려가고 다리는 접힌다
  if (!o.sit) (squatDown ? SQUAT_LEGS : LEGS[o.frame ?? 0]).forEach((row, i) => rows.push([(squatDown ? 14 : 12) + i, 0, row]));
  const cells: [number, number, string][] = [];
  for (const [dy, dx, row] of rows) {
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === ".") continue;
      const cx = dx + i;
      // 머리 위로 바를 든다: 옆 팔을 지우고(머리 바깥으로 세운 팔은 아래에서 따로)
      if (o.over && dy >= 8 && dy <= 10 && (cx < 2 || cx > 7)) continue;
      cells.push([cx, dy, ch]);
    }
  }
  if (pose) for (const [ax, ay] of poseArms(pose, f)) cells.push([ax, ay + (squatDown ? 2 : 0), "s"]);
  return cells;
}

/** 10×16 픽셀 치비(홈 지도 · 라운지 광장 · 던전이 같은 그림) */
export function drawChar(g: CanvasRenderingContext2D, x: number, y0: number, pal: Pal, o: CharOpts = {}) {
  const y = y0 - (o.hop ?? 0);
  const cells = charCells(o, pal.shape);
  if (o.pose === "squat") {
    // 목 뒤 바벨(머리가 앞을 가린다): 봉 · 빨간 원판
    const by = y + 7 + ((o.poseFrame ?? 0) === 1 ? 2 : 0);
    fill(g, x - 7, by - 1, 24, 3, C.ink);
    fill(g, x - 7, by - 4, 4, 9, C.ink);
    fill(g, x + 13, by - 4, 4, 9, C.ink);
    fill(g, x - 6, by, 22, 1, "#B9BCC3");
    fill(g, x - 6, by - 3, 2, 7, C.red);
    fill(g, x + 14, by - 3, 2, 7, C.red);
  }
  g.fillStyle = C.ink;
  for (const [cx, cy] of cells) {
    g.fillRect(x + cx - 1, y + cy, 3, 1);
    g.fillRect(x + cx, y + cy - 1, 1, 3);
  }
  if (o.over) {
    fill(g, x - 2, y - 3, 3, 13, C.ink);
    fill(g, x + 9, y - 3, 3, 13, C.ink);
    fill(g, x - 8, y - 4, 26, 3, C.ink);
    fill(g, x - 7, y - 8, 4, 11, C.ink);
    fill(g, x + 13, y - 8, 4, 11, C.ink);
  }
  for (const [cx, cy, ch] of cells) {
    g.fillStyle = ch === "p" ? (pal.p ?? pal.s) : ch === "d" ? (pal.shape?.band ?? pal.h) : (pal[ch as "h" | "s" | "k" | "r" | "b" | "w"] ?? pal.s);
    g.fillRect(x + cx, y + cy, 1, 1);
  }
  if (o.over) {
    fill(g, x - 1, y - 2, 1, 11, pal.s);
    fill(g, x + 10, y - 2, 1, 11, pal.s);
    fill(g, x, y + 8, 1, 1, pal.s);
    fill(g, x + 9, y + 8, 1, 1, pal.s);
    fill(g, x - 7, y - 3, 24, 1, "#B9BCC3");
    fill(g, x - 6, y - 7, 2, 9, C.red);
    fill(g, x + 14, y - 7, 2, 9, C.red);
  }
}

/** 꾸미기 창: 직원 한 명(지도와 같은 10×16 그림) */
export function paintStaffPreview(canvas: HTMLCanvasElement, id: NpcId, look: StaffLook) {
  canvas.width = 16;
  canvas.height = 20;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.imageSmoothingEnabled = false;
  fill(g, 0, 0, 16, 20, C.floor);
  drawChar(g, 3, 2, npcPal(id, look));
}

/* ---------- 컨트롤러 ---------- */

export type MapState = {
  plates: number;
  checked: boolean;
  loungeCount: number;
  tone: Tone;
  /** 내 캐릭터 모양(머리 · 성별 · 몸 단계 · 머리띠) — 카드 그림과 같게. 없으면 기본 */
  shape?: SpriteShape | null;
  decor?: DecorLayout;
  decorEdit?: boolean;
  decorPick?: SlotId | null;
  scene?: SceneId;
};
export type MapCallbacks = {
  /** 캐릭터가 장소에 도착(또는 떠남) */
  onZone: (zone: MapZone | null) => void;
  /** 매 프레임 캐릭터 머리 위치(픽셀, 지도 좌표) — 이름표 위치용 */
  onPlayer: (x: number, y: number) => void;
  /** 원판이 바벨에 꽂히는 순간 */
  onPlateLanded: () => void;
  /** 매 프레임 직원 NPC 머리 위치(픽셀) — 이름표 · 말풍선 위치용 */
  onNpcs?: (pos: Partial<Record<NpcId, [number, number]>>) => void;
  /** 직원 NPC 를 눌렀을 때 */
  onNpcTalk?: (id: NpcId) => void;
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
  const paintBg = (layout: DecorLayout) => {
    if (!bgCtx) return;
    const theme = THEMES[layout.THEME ?? ""] ?? THEMES.THEME_RUBBER;
    if (currentScene === "MAIN") paintStatic(bgCtx, theme);
    else SCENES[currentScene].paint(bgCtx, theme);
    paintDecor(bgCtx, layout, currentScene);
  };

  let state: MapState = { ...initial };
  setScene(state.scene ?? "MAIN");
  let layout = state.decor ?? DEFAULT_LAYOUT;
  let look = staffLookOf(layout);
  setDecorSolid(layout);
  paintBg(layout);
  let pal = palOf(state.tone, state.shape);
  /** 화면에 꽂혀 보이는 원판 수(출석 연출 중에는 state.plates 보다 하나 적다) */
  let shownPlates = state.plates;
  const player: Walker = { x: START[0], y: START[1], path: [], speed: WALK_SPEED, anim: 0, moving: false, back: true };
  let overUntil = 0;
  /** 출석 축하: 바를 들기 전에 화이팅 자세로 두 번 점프(0.64초) */
  let cheerUntil = 0;
  const CHEER_MS = 640;
  type Npc = { id: NpcId; w: Walker; wait: number; route: number; talkUntil: number };
  const allNpcs: Npc[] = (Object.keys(NPC_PLANS) as NpcId[]).map((id) => {
    const p = NPC_PLANS[id];
    return { id, w: { x: p.start[0], y: p.start[1], path: [], speed: p.speed, anim: 0, moving: false, back: false }, wait: 1 + Math.random() * 2, route: 0, talkUntil: 0 };
  });
  /** 지금 지도에 있는 직원(늘 있는 셋 + 출근시킨 새 직원) */
  let npcs: Npc[] = [];
  const syncNpcs = () => {
    const on = new Set<NpcId>(currentScene === "MAIN" ? [...BASE_NPCS, ...look.hired] : SCENE_NPCS[currentScene]);
    npcs = allNpcs.filter((n) => on.has(n.id));
    allNpcs.forEach((n) => {
      if (on.has(n.id)) return;
      // 쉬는 직원은 다음 출근 때 처음 자리에서
      [n.w.x, n.w.y] = NPC_PLANS[n.id].start;
      n.w.path = [];
      delete npcPos[n.id];
    });
  };
  const npcPos = {} as Partial<Record<NpcId, [number, number]>>;
  syncNpcs();
  let zone: MapZone | null = null;
  let flights: Flight[] = [];
  let particles: Particle[] = [];
  let raf = 0;
  let last = performance.now();

  const puff = (x: number, y: number, n: number) => {
    if (reduce) return;
    for (let i = 0; i < n; i++)
      particles.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 55 - 8, life: 0.5 + Math.random() * 0.5, age: 0 });
  };

  const setZone = (next: MapZone | null) => {
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
    if (currentScene !== "MAIN") return;
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

  const nextNpcTarget = (n: Npc) => {
    const plan = NPC_PLANS[n.id].plan;
    const from: [number, number] = [Math.round(n.w.x), Math.round(n.w.y)];
    if (plan.kind === "route") {
      n.route = (n.route + 1) % plan.points.length;
      const [c, r] = plan.points[n.route];
      n.w.path = findPath(from[0], from[1], c, r) ?? [];
      return;
    }
    for (let i = 0; i < 20; i++) {
      const c = plan.area.c + Math.floor(Math.random() * plan.area.w);
      const r = plan.area.r + Math.floor(Math.random() * plan.area.h);
      if (!walkable(c, r)) continue;
      const path = findPath(from[0], from[1], c, r);
      if (path?.length) {
        n.w.path = path;
        return;
      }
    }
  };

  const updateNpcs = (dt: number, now: number) => {
    for (const n of npcs) {
      // 말하는 중이거나 내 캐릭터가 바로 옆이면 멈춰서 쳐다본다
      const near = Math.hypot(n.w.x - player.x, n.w.y - player.y) < 1.3;
      if (now < n.talkUntil || near) {
        n.w.moving = false;
        n.w.back = player.y < n.w.y - 0.3;
        continue;
      }
      if (n.w.path.length) {
        if (stepWalker(n.w, dt)) {
          const [lo, hi] = NPC_PLANS[n.id].plan.pause;
          n.wait = lo + Math.random() * (hi - lo);
        }
      } else if ((n.wait -= dt) <= 0) {
        nextNpcTarget(n);
        n.wait = 1;
      }
    }
  };

  const drawNpc = (n: Npc, now: number, seed: number) => {
    const px = Math.round(n.w.x * TILE + 3);
    const py = Math.round(n.w.y * TILE) - 1;
    const pose = walkPose(n.w.anim * 7, n.w.moving, now, seed);
    const frame = pose.frame;
    g.globalAlpha = 0.35;
    fill(g, px, py + 15, 10, 2, "#000");
    g.globalAlpha = 1;
    drawChar(g, px, py, npcPal(n.id, look), { frame, back: n.w.back, hop: pose.hop, squash: pose.squash });
    if (n.id === "staff") {
      // 걸레: 자루 + 걸레 머리(걸을 때 좌우로 흔들림)
      const sway = n.w.moving ? (frame === 1 ? -1 : 1) : 0;
      fill(g, px + 11, py + 6, 1, 10, "#8A6A45");
      fill(g, px + 9 + sway, py + 15, 5, 2, C.ink);
      fill(g, px + 10 + sway, py + 15, 3, 1, "#D9D7CF");
    }
    if (n.id === "coach") fill(g, px + 4, py + 8, 2, 1, C.red); // 호루라기
    if (n.id === "trainer") {
      // 클립보드
      fill(g, px + 9, py + 7, 4, 6, C.ink);
      fill(g, px + 10, py + 8, 2, 4, C.chalk);
      fill(g, px + 10, py + 7, 2, 1, C.steelL);
    }
    if (n.id === "cleaner") {
      // 분무기 + 걸레
      fill(g, px - 3, py + 7, 3, 5, C.ink);
      fill(g, px - 2, py + 8, 1, 3, C.blue);
      fill(g, px - 3, py + 6, 2, 1, C.chalk);
      fill(g, px + 10, py + 10, 3, 2, "#D9D7CF");
    }
    if (n.id === "runcoach") {
      // 초시계 + 머리띠
      fill(g, px + 9, py + 8, 4, 4, C.ink);
      fill(g, px + 10, py + 9, 2, 2, C.chalk);
      fill(g, px + 1, py + 1, 8, 1, C.red);
    }
    if (n.id === "dietitian") {
      // 식단표 클립보드(초록 줄)
      fill(g, px + 9, py + 7, 4, 6, C.ink);
      fill(g, px + 10, py + 8, 2, 4, C.chalk);
      fill(g, px + 10, py + 9, 2, 1, C.green);
      fill(g, px + 10, py + 11, 2, 1, C.green);
    }
    if (n.id === "towel") {
      // 팔에 걸친 수건 더미
      fill(g, px + 9, py + 7, 5, 5, C.ink);
      fill(g, px + 10, py + 8, 3, 1, C.chalk);
      fill(g, px + 10, py + 9, 3, 1, "#9EC1E8");
      fill(g, px + 10, py + 10, 3, 1, C.chalk);
    }
    npcPos[n.id] = [px + 5, py - 3];
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
    if (!zone || zone === "portal" || zone === "exit") return;
    const [x, y, w, h] = ZONES[zone].box;
    const L = 5;
    g.globalAlpha = 0.55 + 0.45 * Math.sin(now / 160);
    for (const [px, py] of [[x, y], [x + w - L, y], [x, y + h - 1], [x + w - L, y + h - 1]]) fill(g, px, py, L, 1, C.yellow);
    for (const [px, py] of [[x, y], [x + w - 1, y], [x, y + h - L], [x + w - 1, y + h - L]]) fill(g, px, py, 1, L, C.yellow);
    g.globalAlpha = 1;
  };

  // 꾸미기 중: 자리마다 노란 점선, 고른 자리는 깜빡이는 실선
  const drawDecorSlots = (now: number) => {
    if (!state.decorEdit) return;
    for (const id of SLOT_IDS) {
      if (SLOTS[id].scene !== currentScene) continue;
      const [x, y, w, h] = SLOTS[id].box;
      const picked = state.decorPick === id;
      g.globalAlpha = picked ? 0.6 + 0.4 * Math.sin(now / 140) : 0.85;
      if (picked) {
        fill(g, x, y, w, 1, C.yellow);
        fill(g, x, y + h - 1, w, 1, C.yellow);
        fill(g, x, y, 1, h, C.yellow);
        fill(g, x + w - 1, y, 1, h, C.yellow);
      } else {
        for (let i = 0; i < w; i += 4) {
          fill(g, x + i, y, 2, 1, C.yellow);
          fill(g, x + i, y + h - 1, 2, 1, C.yellow);
        }
        for (let i = 0; i < h; i += 4) {
          fill(g, x, y + i, 1, 2, C.yellow);
          fill(g, x + w - 1, y + i, 1, 2, C.yellow);
        }
      }
      g.globalAlpha = 1;
    }
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

    const main = currentScene === "MAIN";
    const arrived = stepWalker(player, dt);
    updateNpcs(dt, now);
    const here = zoneAt(Math.round(player.x), Math.round(player.y));
    if (player.moving && zone && here !== zone) setZone(null);
    if (arrived && here) setZone(here);

    g.drawImage(bg, 0, 0);
    if (main) drawDynamic(now);
    drawHighlight(now);
    drawDecorSlots(now);
    if (main && !state.checked) marker(156, 300 + Math.round(Math.sin(now / 220) * 1.5), C.red);

    const px = Math.round(player.x * TILE + 3);
    const py = Math.round(player.y * TILE) - 1;
    const cheering = now < cheerUntil;
    const over = !cheering && now < overUntil;
    // 점프: 0.32초에 한 번씩 4칸 높이 포물선
    const jump = cheering ? Math.round(Math.sin((((now - (cheerUntil - CHEER_MS)) % 320) / 320) * Math.PI) * 4) : 0;
    // 기구 앞에 멈춰 서면 운동: 파워랙 스쿼트 · 거울 알통 · 러닝머신 제자리 달리기(1층에서만)
    const gear = main && !player.moving && !over && (zone === "rack" || zone === "mirror" || zone === "crew") ? zone : null;
    const walk = gear === "crew" ? walkPose(now / 90, true, now) : walkPose(player.anim * 12, player.moving && !over, now);
    const gearPose: SpritePose | null = gear === "rack" ? "squat" : gear === "mirror" ? "flex" : null;
    const gearFrame = Math.floor(now / (gear === "rack" ? 650 : 750)) % 2;
    const sitters = main ? Math.min(3, Math.max(0, state.loungeCount)) : 0;
    const actors: { y: number; draw: () => void }[] = [];
    for (let i = 0; i < sitters; i++) {
      const [sx, sy] = SEATS[i];
      actors.push({ y: sy + 16, draw: () => drawChar(g, sx, sy, GUESTS[i], { sit: true, squash: walkPose(0, false, now, i + 3).squash }) });
    }
    npcs.forEach((n, i) => actors.push({ y: n.w.y * TILE + 15, draw: () => drawNpc(n, now, i + 1) }));
    actors.push({
      y: py + 16.5,
      draw: () => {
        g.globalAlpha = 0.6;
        fill(g, px - 1, py + 15, 12, 2, C.yellow);
        fill(g, px + 1, py + 17, 8, 1, C.yellow);
        g.globalAlpha = 1;
        drawChar(g, px, py, pal, {
          frame: over || cheering ? 0 : walk.frame,
          back: !over && !cheering && !gear && player.back,
          over,
          hop: cheering ? jump : gearPose ? 0 : walk.hop,
          squash: !over && !cheering && !gearPose && walk.squash,
          pose: cheering ? "cheer" : gearPose,
          poseFrame: cheering ? (jump > 1 ? 1 : 0) : gearFrame,
        });
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
    cb.onNpcs?.(npcPos);
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
      if (next.tone || next.shape !== undefined) pal = palOf(state.tone, state.shape);
      if (next.scene && next.scene !== currentScene) {
        // 다른 공간으로: 막힌 칸 · 배경을 바꾸고 그 공간 입구에 선다
        setScene(next.scene);
        player.path = [];
        [player.x, player.y] = next.scene === "MAIN" ? PORTAL_RETURN : SCENES[next.scene].start;
        player.back = true;
        zone = null;
        flights = [];
        setDecorSolid(layout);
        paintBg(layout);
        syncNpcs();
      }
      if (next.decor && next.decor !== layout) {
        layout = next.decor;
        look = staffLookOf(layout);
        setDecorSolid(layout);
        paintBg(layout);
        syncNpcs();
      }
      if (platesChanged && !flights.length) shownPlates = state.plates;
    },
    tapAt(fx, fy) {
      let c = Math.floor((fx * MAP_W) / TILE);
      let r = Math.floor((fy * MAP_H) / TILE);
      // 직원 NPC 를 눌렀으면: 그 사람 옆으로 걸어가고, 그 자리에서 말한다
      const tx = fx * MAP_W;
      const ty = fy * MAP_H;
      const who = npcs.find((n) => {
        const nx = n.w.x * TILE + 3;
        const ny = n.w.y * TILE - 1;
        return tx >= nx - 3 && tx <= nx + 13 && ty >= ny - 3 && ty <= ny + 18;
      });
      if (who) {
        who.talkUntil = performance.now() + 3500;
        who.w.moving = false;
        cb.onNpcTalk?.(who.id);
        const nc = Math.round(who.w.x);
        const nr = Math.round(who.w.y);
        const spot = [[nc, nr + 1], [nc - 1, nr], [nc + 1, nr], [nc, nr - 1]].find(([a, b]) => walkable(a, b));
        if (spot) goTile(spot[0], spot[1]);
        return;
      }
      if (currentScene === "MAIN") {
        const hit = OBJ.find((o) => o.zone && inRect(o, c, r));
        if (hit?.zone) return goZone(hit.zone);
        if (r < 2 && c >= 9 && c <= 14) return goZone("mirror");
      }
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
      // 출석 체크기 앞에서 원판이 날아가 바벨에 꽂히고, 캐릭터가 바벨을 든다(1층에서만)
      if (currentScene !== "MAIN") return;
      shownPlates = Math.max(0, state.plates - 1);
      player.path = [];
      [player.x, player.y] = ZONES.checkin.anchor;
      // 화이팅 점프 두 번 → 바벨 번쩍(움직임 줄이기면 바로 든다)
      cheerUntil = reduce ? 0 : performance.now() + CHEER_MS;
      overUntil = performance.now() + (reduce ? 0 : CHEER_MS) + 1700;
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
