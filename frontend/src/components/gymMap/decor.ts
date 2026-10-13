// 헬스장 꾸미기 — 꾸미기 자리(슬롯)의 위치와 물품 그림.
//
// 물품 목록 · 얻는 조건은 서버(GymDecorItem.java)가 정하고, 여기서는 같은 코드로 그림만 그린다(둘 다 고칠 것).
// 기본 시설(출석 체크기 · 라운지 · 게시판 …)과 걷는 길은 건드리지 않는 빈자리만 슬롯으로 썼다.
// 줄이 없으면 기본 물품: 구석 세 곳은 화분, 가운데 바닥은 빨간 원판 무늬(꾸미기 전 지도와 똑같다).
// 자리는 공간(scene)마다 따로다: 1층(MAIN) · 2층 · 러닝 트랙 · 식당. 공간 그림 · 막힌 칸은 scenes.ts.

export type SlotId =
  | "WALL"
  | "PLATFORM_SIDE"
  | "CORNER_TOP"
  | "FLOOR_LEFT"
  | "CENTER"
  | "CHECKIN_SIDE"
  | "COUNTER"
  | "CORNER_LEFT"
  | "CORNER_RIGHT"
  | "F2_WALL_L"
  | "F2_WALL_R"
  | "F2_FLOOR_A"
  | "F2_FLOOR_B"
  | "F2_FLOOR_C"
  | "F2_TALL_A"
  | "F2_TALL_B"
  | "F2_SIDE"
  | "F2_CORNER_L"
  | "F2_CORNER_R"
  | "TR_FIELD_A"
  | "TR_FIELD_B"
  | "TR_FIELD_C"
  | "TR_FIELD_D"
  | "TR_LINE"
  | "DN_WALL"
  | "DN_COUNTER_A"
  | "DN_COUNTER_B"
  | "DN_COUNTER_C"
  | "DN_SIDE_L"
  | "DN_SIDE_R"
  | "DN_CORNER_L"
  | "DN_CORNER_R";

/** 공간: 1층(처음부터) · 2층 · 야외 러닝 트랙 · 단백질 식당. 열리는 조건은 서버 SPACE_* 물품 */
export type SceneId = "MAIN" | "FLOOR2" | "TRACK" | "DINER";
export const SCENE_UNLOCK: Record<Exclude<SceneId, "MAIN">, string> = {
  FLOOR2: "SPACE_FLOOR2",
  TRACK: "SPACE_TRACK",
  DINER: "SPACE_DINER",
};

/** 지도 위 자리가 아닌 설정 칸: 테마 · 유니폼 · 새 직원 출근 · 직원별 머리색(서버 GymDecorItem.Slot 과 같다) */
export type StaffId = "coach" | "owner" | "staff" | "trainer" | "cleaner" | "towel";
export type HireSlot = "HIRE_TRAINER" | "HIRE_CLEANER" | "HIRE_TOWEL";
export type HairSlot = "HAIR_COACH" | "HAIR_OWNER" | "HAIR_STAFF" | "HAIR_TRAINER" | "HAIR_CLEANER" | "HAIR_TOWEL";
export type DecorSlot = SlotId | "THEME" | "UNIFORM" | HireSlot | HairSlot;

export type DecorLayout = Partial<Record<DecorSlot, string | null>>;

export const HAIR_SLOT: Record<StaffId, HairSlot> = {
  coach: "HAIR_COACH", owner: "HAIR_OWNER", staff: "HAIR_STAFF",
  trainer: "HAIR_TRAINER", cleaner: "HAIR_CLEANER", towel: "HAIR_TOWEL",
};
/** 새 직원: 출근 자리 · 물품 코드 */
export const HIRES: { id: StaffId; slot: HireSlot; code: string }[] = [
  { id: "trainer", slot: "HIRE_TRAINER", code: "TRAINER" },
  { id: "cleaner", slot: "HIRE_CLEANER", code: "CLEANER" },
  { id: "towel", slot: "HIRE_TOWEL", code: "TOWEL" },
];

export const UNIFORM_COLOR: Record<string, string> = {
  UNIFORM_YELLOW: "#F0BE2E", UNIFORM_ORANGE: "#E8772E", UNIFORM_WHITE: "#E4E2DA", UNIFORM_CHARCOAL: "#3A3C42",
};
export const HAIR_COLOR: Record<string, string> = {
  HAIR_BLACK: "#1B1B1F", HAIR_BROWN: "#5A3A22", HAIR_GRAY: "#8C8F96", HAIR_BLOND: "#C9A25A",
};

/** 지도에 그릴 직원 모습(레이아웃에서 뽑는다) */
export type StaffLook = { hired: StaffId[]; uniform: string; hair: Record<StaffId, string> };
export function staffLookOf(layout: DecorLayout): StaffLook {
  const hair = {} as Record<StaffId, string>;
  (Object.keys(HAIR_SLOT) as StaffId[]).forEach((id) => {
    hair[id] = HAIR_COLOR[layout[HAIR_SLOT[id]] ?? DEFAULT_LAYOUT[HAIR_SLOT[id]] ?? ""] ?? HAIR_COLOR.HAIR_BLACK;
  });
  return {
    hired: HIRES.filter((h) => layout[h.slot] === h.code).map((h) => h.id),
    uniform: UNIFORM_COLOR[layout.UNIFORM ?? ""] ?? UNIFORM_COLOR.UNIFORM_YELLOW,
    hair,
  };
}

type Rect = { c: number; r: number; w: number; h: number };
export type SlotSpec = {
  name: string;
  scene: SceneId;
  /** 그림 · 테두리 영역(지도 픽셀) */
  box: [number, number, number, number];
  /** 물품이 놓이면 못 지나가는 칸 */
  solid?: Rect;
};

export const SLOTS: Record<SlotId, SlotSpec> = {
  WALL: { name: "벽 장식", scene: "MAIN", box: [96, 4, 48, 28] },
  PLATFORM_SIDE: { name: "플랫폼 옆", scene: "MAIN", box: [112, 78, 32, 34], solid: { c: 7, r: 5, w: 2, h: 2 } },
  CORNER_TOP: { name: "오른쪽 위 구석", scene: "MAIN", box: [224, 92, 16, 24], solid: { c: 14, r: 6, w: 1, h: 1 } },
  FLOOR_LEFT: { name: "왼쪽 바닥", scene: "MAIN", box: [16, 204, 48, 36], solid: { c: 1, r: 13, w: 3, h: 2 } },
  CENTER: { name: "가운데 바닥", scene: "MAIN", box: [96, 192, 48, 48] },
  CHECKIN_SIDE: { name: "출석 체크기 옆", scene: "MAIN", box: [206, 312, 34, 42], solid: { c: 13, r: 21, w: 2, h: 1 } },
  COUNTER: { name: "카운터 위", scene: "MAIN", box: [34, 312, 24, 20] },
  CORNER_LEFT: { name: "왼쪽 아래 구석", scene: "MAIN", box: [16, 364, 16, 24], solid: { c: 1, r: 23, w: 1, h: 1 } },
  CORNER_RIGHT: { name: "오른쪽 아래 구석", scene: "MAIN", box: [224, 364, 16, 24], solid: { c: 14, r: 23, w: 1, h: 1 } },
  // 2층
  F2_WALL_L: { name: "왼쪽 벽", scene: "FLOOR2", box: [32, 4, 48, 28] },
  F2_WALL_R: { name: "오른쪽 벽", scene: "FLOOR2", box: [176, 4, 48, 28] },
  F2_FLOOR_A: { name: "왼쪽 위 바닥", scene: "FLOOR2", box: [32, 92, 48, 36], solid: { c: 2, r: 6, w: 3, h: 2 } },
  F2_FLOOR_B: { name: "오른쪽 위 바닥", scene: "FLOOR2", box: [176, 92, 48, 36], solid: { c: 11, r: 6, w: 3, h: 2 } },
  F2_TALL_A: { name: "왼쪽 기구 자리", scene: "FLOOR2", box: [32, 186, 32, 34], solid: { c: 2, r: 12, w: 2, h: 2 } },
  F2_TALL_B: { name: "오른쪽 기구 자리", scene: "FLOOR2", box: [192, 186, 32, 34], solid: { c: 12, r: 12, w: 2, h: 2 } },
  F2_FLOOR_C: { name: "가운데 바닥", scene: "FLOOR2", box: [96, 268, 48, 36], solid: { c: 6, r: 17, w: 3, h: 2 } },
  F2_SIDE: { name: "계단 옆", scene: "FLOOR2", box: [206, 296, 34, 42], solid: { c: 13, r: 20, w: 2, h: 1 } },
  F2_CORNER_L: { name: "왼쪽 아래 구석", scene: "FLOOR2", box: [16, 364, 16, 24], solid: { c: 1, r: 23, w: 1, h: 1 } },
  F2_CORNER_R: { name: "오른쪽 아래 구석", scene: "FLOOR2", box: [224, 364, 16, 24], solid: { c: 14, r: 23, w: 1, h: 1 } },
  // 러닝 트랙(안쪽 잔디 넷 + 오른쪽 직선 결승선)
  TR_FIELD_A: { name: "잔디 왼쪽 위", scene: "TRACK", box: [60, 150, 48, 36], solid: { c: 4, r: 10, w: 3, h: 2 } },
  TR_FIELD_B: { name: "잔디 오른쪽 위", scene: "TRACK", box: [148, 150, 48, 36], solid: { c: 9, r: 10, w: 3, h: 2 } },
  TR_FIELD_C: { name: "잔디 왼쪽 아래", scene: "TRACK", box: [60, 250, 48, 36], solid: { c: 4, r: 16, w: 3, h: 2 } },
  TR_FIELD_D: { name: "잔디 오른쪽 아래", scene: "TRACK", box: [148, 250, 48, 36], solid: { c: 9, r: 16, w: 3, h: 2 } },
  TR_LINE: { name: "결승선", scene: "TRACK", box: [200, 200, 32, 24] },
  // 식당
  DN_WALL: { name: "주방 벽", scene: "DINER", box: [104, 2, 48, 28] },
  DN_COUNTER_A: { name: "조리대 왼쪽", scene: "DINER", box: [24, 16, 32, 28] },
  DN_COUNTER_B: { name: "조리대 가운데", scene: "DINER", box: [64, 16, 32, 28] },
  DN_COUNTER_C: { name: "조리대 오른쪽", scene: "DINER", box: [200, 16, 32, 28] },
  DN_SIDE_L: { name: "왼쪽 벽 옆", scene: "DINER", box: [16, 296, 34, 42], solid: { c: 1, r: 20, w: 2, h: 1 } },
  DN_SIDE_R: { name: "오른쪽 벽 옆", scene: "DINER", box: [206, 296, 34, 42], solid: { c: 13, r: 20, w: 2, h: 1 } },
  DN_CORNER_L: { name: "왼쪽 아래 구석", scene: "DINER", box: [16, 364, 16, 24], solid: { c: 1, r: 23, w: 1, h: 1 } },
  DN_CORNER_R: { name: "오른쪽 아래 구석", scene: "DINER", box: [224, 364, 16, 24], solid: { c: 14, r: 23, w: 1, h: 1 } },
};
export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];

/** 서버 응답 전 · 로그인 전에 보이는 모습(지금까지의 지도와 같다) */
export const DEFAULT_LAYOUT: DecorLayout = {
  CORNER_TOP: "PLANT", CORNER_LEFT: "PLANT", CORNER_RIGHT: "PLANT", CENTER: "RING_RED",
  THEME: "THEME_RUBBER", UNIFORM: "UNIFORM_YELLOW",
  HAIR_COACH: "HAIR_BLACK", HAIR_OWNER: "HAIR_GRAY", HAIR_STAFF: "HAIR_BROWN",
  HAIR_TRAINER: "HAIR_BLACK", HAIR_CLEANER: "HAIR_BROWN", HAIR_TOWEL: "HAIR_BLOND",
  F2_CORNER_L: "PLANT", F2_CORNER_R: "PLANT", DN_CORNER_L: "PLANT", DN_CORNER_R: "PLANT",
};

const K = {
  ink: "#0E0E10", steel: "#4A4C53", steelD: "#2E3035", steelL: "#6B6E76", chalk: "#F3F1EA",
  red: "#D9302A", blue: "#2F6FD0", yellow: "#F0BE2E", green: "#2E9C55", gold: "#C9961E", pad: "#3B3D44",
};

type G = CanvasRenderingContext2D;
const fill = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function plant(g: G, x: number, y: number) {
  fill(g, x + 1, y + 2, 14, 12, K.ink);
  fill(g, x + 2, y + 3, 12, 10, "#2F6B3A");
  fill(g, x + 4, y + 3, 6, 4, "#3E8A4B");
  fill(g, x + 9, y + 7, 3, 3, "#56A866");
  fill(g, x + 3, y + 13, 10, 7, K.ink);
  fill(g, x + 4, y + 14, 8, 5, "#5B4636");
}

function fan(g: G, x: number, y: number) {
  fill(g, x + 7, y + 11, 2, 9, K.steelD);
  fill(g, x + 3, y + 19, 10, 3, K.ink);
  fill(g, x + 4, y + 19, 8, 2, K.steel);
  fill(g, x + 1, y + 1, 14, 12, K.ink);
  fill(g, x + 2, y + 2, 12, 10, K.steelL);
  fill(g, x + 3, y + 3, 10, 8, "#9EC1E8");
  fill(g, x + 7, y + 3, 2, 8, K.chalk);
  fill(g, x + 3, y + 6, 10, 2, K.chalk);
  fill(g, x + 7, y + 6, 2, 2, K.red);
}

function scale(g: G, x: number, y: number, w: number) {
  const sx = x + ((w - 14) >> 1);
  fill(g, sx, y + 12, 14, 10, K.ink);
  fill(g, sx + 1, y + 13, 12, 8, "#D9D7CF");
  fill(g, sx + 4, y + 14, 6, 3, "#12301A");
  fill(g, sx + 5, y + 15, 4, 1, K.green);
  fill(g, sx + 2, y + 19, 3, 1, "#A9A79F");
  fill(g, sx + 9, y + 19, 3, 1, "#A9A79F");
}

function clock(g: G, x: number, y: number, w: number) {
  const cx = x + (w >> 1);
  fill(g, cx - 7, y + 5, 14, 16, K.ink);
  fill(g, cx - 8, y + 7, 16, 12, K.ink);
  fill(g, cx - 6, y + 6, 12, 14, K.chalk);
  fill(g, cx - 7, y + 8, 14, 10, K.chalk);
  for (const [dx, dy] of [[0, 7], [0, 18], [-6, 12], [5, 12]]) fill(g, cx + dx, y + dy, 1, 1, K.steel);
  fill(g, cx, y + 9, 1, 4, K.ink);
  fill(g, cx, y + 12, 4, 1, K.ink);
  fill(g, cx - 1, y + 12, 1, 4, K.red);
}

function banner(g: G, x: number, y: number, w: number) {
  const left = x + 6;
  const width = w - 12;
  fill(g, left - 2, y + 4, width + 4, 2, K.steelD);
  fill(g, left, y + 6, width, 15, K.ink);
  fill(g, left + 1, y + 6, width - 2, 14, K.red);
  fill(g, left + 1, y + 9, width - 2, 2, K.yellow);
  // 아래 삼각 자르기
  for (let i = 0; i < 4; i++) fill(g, left + (width >> 1) - 4 + i, y + 18 + i, 8 - i * 2, 1, "#34363C");
  for (let i = 0; i < 3; i++) fill(g, left + 1, y + 20 + i, width - 2 - i * 2, 1, K.red);
  // 원판 무늬
  fill(g, left + (width >> 1) - 3, y + 12, 6, 5, K.ink);
  fill(g, left + (width >> 1) - 2, y + 13, 4, 3, K.chalk);
  fill(g, left + (width >> 1) - 1, y + 14, 2, 1, K.ink);
}

function cup(g: G, cx: number, bottom: number) {
  fill(g, cx - 5, bottom - 3, 10, 3, K.ink);
  fill(g, cx - 4, bottom - 2, 8, 1, K.steelL);
  fill(g, cx - 1, bottom - 6, 2, 3, K.gold);
  fill(g, cx - 6, bottom - 14, 12, 9, K.ink);
  fill(g, cx - 5, bottom - 13, 10, 7, K.yellow);
  fill(g, cx - 4, bottom - 12, 2, 4, "#FBE7A1");
  fill(g, cx - 8, bottom - 13, 3, 4, K.ink);
  fill(g, cx + 5, bottom - 13, 3, 4, K.ink);
  fill(g, cx - 7, bottom - 12, 1, 2, K.yellow);
  fill(g, cx + 6, bottom - 12, 1, 2, K.yellow);
}

function trophy(g: G, x: number, y: number, w: number, h: number, onWall: boolean) {
  if (onWall) {
    fill(g, x + 4, y + h - 5, w - 8, 3, K.ink);
    fill(g, x + 5, y + h - 5, w - 10, 1, "#A47141");
    cup(g, x + (w >> 1), y + h - 5);
    return;
  }
  cup(g, x + (w >> 1), y + h - 1);
}

function kettlebells(g: G, x: number, y: number, w: number, h: number) {
  const accents = [K.red, K.blue, K.yellow];
  const gap = Math.min(12, Math.floor((w - 6) / 3));
  const start = x + ((w - gap * 3) >> 1) + 1;
  const base = y + h - 4;
  fill(g, start - 2, base, gap * 3 + 2, 3, K.steelD);
  accents.forEach((col, i) => {
    const kx = start + i * gap;
    fill(g, kx + 1, base - 13, 7, 2, K.ink);
    fill(g, kx + 1, base - 11, 2, 4, K.ink);
    fill(g, kx + 6, base - 11, 2, 4, K.ink);
    fill(g, kx, base - 8, 9, 8, K.ink);
    fill(g, kx + 1, base - 7, 7, 6, "#26272B");
    fill(g, kx + 2, base - 6, 2, 2, K.steel);
    fill(g, kx + 1, base - 3, 7, 1, col);
  });
}

function smith(g: G, x: number, y: number, w: number, h: number) {
  fill(g, x + 2, y + h - 4, w - 4, 3, K.ink);
  for (const px of [x + 4, x + w - 7]) {
    fill(g, px - 1, y + 1, 5, h - 4, K.ink);
    fill(g, px, y + 2, 3, h - 6, K.steel);
    fill(g, px, y + 2, 1, h - 6, K.steelL);
  }
  fill(g, x + 3, y + 1, w - 6, 3, K.steelD);
  const by = y + 15;
  fill(g, x, by, w, 2, "#9A9DA5");
  for (const px of [x + 1, x + w - 4]) {
    fill(g, px - 1, by - 6, 5, 14, K.ink);
    fill(g, px, by - 5, 3, 12, K.red);
  }
}

function bench(g: G, x: number, y: number, w: number, h: number) {
  const top = y + h - 16;
  for (const lx of [x + 8, x + w - 12]) fill(g, lx, top + 6, 4, 9, K.steelD);
  fill(g, x + 4, top, w - 8, 8, K.ink);
  fill(g, x + 5, top + 1, w - 10, 6, K.pad);
  fill(g, x + 5, top + 1, w - 10, 1, "#4C4F57");
  fill(g, x + 5, top + 5, w - 10, 2, K.red);
  // 머리 쪽 받침대
  fill(g, x + w - 8, top - 12, 3, 13, K.ink);
  fill(g, x + w - 7, top - 11, 1, 11, K.steelL);
  fill(g, x + w - 11, top - 12, 9, 2, K.ink);
}

function bike(g: G, x: number, y: number, w: number, h: number) {
  const fx = x + 13;
  const fy = y + h - 12;
  // 플라이휠
  fill(g, fx - 7, fy - 6, 14, 12, K.ink);
  fill(g, fx - 6, fy - 5, 12, 10, K.steel);
  fill(g, fx - 3, fy - 2, 6, 4, K.red);
  fill(g, fx - 1, fy - 1, 2, 2, K.ink);
  // 몸통 · 다리
  fill(g, x + 6, y + h - 4, w - 14, 3, K.ink);
  fill(g, fx + 4, fy - 3, 16, 3, K.ink);
  fill(g, fx + 5, fy - 2, 14, 1, K.steelL);
  fill(g, x + 31, y + 8, 3, fy - y - 6, K.ink);
  // 안장
  fill(g, x + 27, y + 5, 12, 4, K.ink);
  fill(g, x + 28, y + 6, 10, 2, K.pad);
  // 핸들
  fill(g, x + 9, y + 4, 3, fy - y - 9, K.ink);
  fill(g, x + 5, y + 2, 10, 3, K.ink);
  fill(g, x + 6, y + 3, 8, 1, K.yellow);
}

function fridge(g: G, x: number, y: number, w: number, h: number) {
  const fw = 24;
  const fx = x + ((w - fw) >> 1);
  const fy = y + 2;
  const fh = h - 4;
  fill(g, fx, fy, fw, fh, K.ink);
  fill(g, fx + 1, fy + 1, fw - 2, fh - 2, K.steel);
  fill(g, fx + 1, fy + 1, fw - 2, 4, K.red);
  fill(g, fx + 3, fy + 2, 8, 2, K.chalk);
  fill(g, fx + 3, fy + 7, fw - 6, fh - 12, "#1B2A33");
  const cols = [K.blue, K.green, K.yellow, K.red, K.chalk];
  for (let row = 0; row < 3; row++) {
    const ry = fy + 9 + row * 8;
    fill(g, fx + 3, ry + 5, fw - 6, 1, K.steelL);
    for (let i = 0; i < 4; i++) {
      fill(g, fx + 5 + i * 4, ry, 2, 5, cols[(row + i) % cols.length]);
      fill(g, fx + 5 + i * 4, ry - 1, 2, 1, K.chalk);
    }
  }
  fill(g, fx + fw - 4, fy + 14, 1, 8, K.chalk);
}

function tub(g: G, x: number, bottom: number) {
  fill(g, x, bottom - 12, 10, 12, K.ink);
  fill(g, x + 1, bottom - 11, 8, 10, "#26272B");
  fill(g, x + 1, bottom - 12, 8, 2, K.steelL);
  fill(g, x + 1, bottom - 7, 8, 3, K.red);
  fill(g, x + 3, bottom - 6, 4, 1, K.chalk);
}

function protein(g: G, x: number, y: number, w: number, h: number, onCounter: boolean) {
  if (onCounter) {
    tub(g, x + 2, y + h - 1);
    tub(g, x + 12, y + h - 1);
    return;
  }
  // 작은 선반 위 통 두 개
  const sy = y + h - 10;
  fill(g, x + 4, sy, w - 8, 3, K.ink);
  fill(g, x + 5, sy, w - 10, 1, "#A47141");
  fill(g, x + 6, sy + 3, 2, 7, K.steelD);
  fill(g, x + w - 8, sy + 3, 2, 7, K.steelD);
  tub(g, x + 6, sy);
  tub(g, x + w - 16, sy);
}

function ring(g: G, x: number, y: number, w: number, h: number, outer: string, inner: string) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  g.save();
  g.lineWidth = 4;
  g.strokeStyle = outer;
  g.beginPath();
  g.arc(cx, cy, 21, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = inner;
  g.beginPath();
  g.arc(cx, cy, 8, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

function yogaMat(g: G, x: number, y: number, h: number) {
  // 바닥에 깐 매트 두 장 + 폼롤러
  const top = y + h - 22;
  fill(g, x + 3, top, 18, 20, K.ink);
  fill(g, x + 4, top + 1, 16, 18, "#2F8F7A");
  fill(g, x + 4, top + 1, 16, 2, "#3FAE96");
  fill(g, x + 23, top, 18, 20, K.ink);
  fill(g, x + 24, top + 1, 16, 18, "#7A4FB0");
  fill(g, x + 24, top + 1, 16, 2, "#9A72CC");
  fill(g, x + 42, top + 6, 5, 12, K.ink);
  fill(g, x + 43, top + 7, 3, 10, K.blue);
}

function sandbag(g: G, x: number, y: number, w: number, h: number) {
  const cx = x + (w >> 1);
  fill(g, cx - 1, y, 2, 6, K.steelD);
  fill(g, cx - 6, y + 5, 12, h - 9, K.ink);
  fill(g, cx - 5, y + 6, 10, h - 11, "#7A2A22");
  fill(g, cx - 5, y + 6, 2, h - 11, "#9A3A30");
  fill(g, cx - 5, y + 12, 10, 1, K.ink);
  fill(g, cx - 5, y + h - 10, 10, 1, K.ink);
  fill(g, cx - 4, y + h - 4, 8, 2, "#1B1C1F");
}

function pullupBar(g: G, x: number, y: number, w: number, h: number) {
  for (const px of [x + 3, x + w - 6]) {
    fill(g, px - 1, y + 2, 5, h - 4, K.ink);
    fill(g, px, y + 3, 3, h - 6, K.steel);
  }
  fill(g, x + 1, y + 4, w - 2, 3, K.ink);
  fill(g, x + 2, y + 5, w - 4, 1, "#C6C8CE");
  fill(g, x + 1, y + h - 3, w - 2, 2, K.ink);
}

function cones(g: G, x: number, y: number, w: number, h: number) {
  const n = w >= 40 ? 3 : 2;
  const gap = Math.floor((w - 4) / n);
  for (let i = 0; i < n; i++) {
    const cx = x + 4 + i * gap + (gap >> 1);
    const by = y + h - 3;
    fill(g, cx - 5, by, 10, 2, K.ink);
    for (let k = 0; k < 8; k++) fill(g, cx - (k >> 1) - 1, by - 8 + k, 2 + (k >> 1) * 2, 1, k === 3 || k === 4 ? K.chalk : "#F07A1E");
  }
}

function waterStation(g: G, x: number, y: number, w: number, h: number) {
  const sx = x + ((w - 20) >> 1);
  const top = y + h - 30;
  fill(g, sx, top + 8, 20, 22, K.ink);
  fill(g, sx + 1, top + 9, 18, 20, "#D9D7CF");
  fill(g, sx + 3, top, 14, 10, K.ink);
  fill(g, sx + 4, top + 1, 12, 8, "#6FA8DC");
  fill(g, sx + 5, top + 2, 2, 6, "#A9CCEA");
  fill(g, sx + 8, top + 14, 4, 2, K.blue);
  for (let i = 0; i < 3; i++) fill(g, sx + 3 + i * 5, top + 20, 3, 5, i === 1 ? K.yellow : K.chalk);
}

function finishFlag(g: G, x: number, y: number, w: number, h: number) {
  // 결승 테이프 + 양쪽 기둥 + 체크 깃발
  fill(g, x + 1, y + 2, 3, h - 2, K.ink);
  fill(g, x + w - 4, y + 2, 3, h - 2, K.ink);
  fill(g, x + 2, y + 3, 1, h - 4, K.chalk);
  fill(g, x + w - 3, y + 3, 1, h - 4, K.chalk);
  fill(g, x + 3, y + 10, w - 6, 2, K.red);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) fill(g, x + 5 + i * 2, y + 1 + j * 2, 2, 2, (i + j) % 2 ? K.ink : K.chalk);
  fill(g, x + 2, y + h - 3, w - 4, 1, K.chalk);
}

function riceCooker(g: G, x: number, y: number, w: number, h: number) {
  const cx = x + (w >> 1);
  const by = y + h - 1;
  fill(g, cx - 9, by - 14, 18, 14, K.ink);
  fill(g, cx - 8, by - 13, 16, 12, "#E9E4D8");
  fill(g, cx - 8, by - 13, 16, 3, "#C9C3B4");
  fill(g, cx - 3, by - 16, 6, 3, K.ink);
  fill(g, cx - 2, by - 15, 4, 1, K.steelL);
  fill(g, cx - 4, by - 7, 8, 3, K.ink);
  fill(g, cx - 3, by - 6, 2, 1, K.green);
  fill(g, cx + 1, by - 6, 2, 1, K.red);
}

function saladBar(g: G, x: number, y: number, w: number, h: number) {
  const bw = w - 6;
  const bx = x + 3;
  const top = y + h - 22;
  fill(g, bx, top, bw, 22, K.ink);
  fill(g, bx + 1, top + 1, bw - 2, 6, "#A9CCEA");
  fill(g, bx + 1, top + 7, bw - 2, 14, K.steel);
  const cols = [K.green, "#E35D3A", K.yellow, "#7FBF5A"];
  for (let i = 0; i < 4; i++) fill(g, bx + 2 + i * Math.floor((bw - 4) / 4), top + 2, Math.floor((bw - 4) / 4) - 1, 4, cols[i]);
  fill(g, bx + 3, top + 10, bw - 6, 1, K.steelL);
}

function menuBoard(g: G, x: number, y: number, w: number) {
  const bx = x + 4;
  const bw = w - 8;
  fill(g, bx, y + 4, bw, 22, "#5A3A22");
  fill(g, bx + 2, y + 6, bw - 4, 18, "#1F2A24");
  const lines = [K.chalk, K.yellow, K.chalk, "#9EC1E8"];
  lines.forEach((col, i) => {
    fill(g, bx + 5, y + 9 + i * 4, 14 - (i % 2) * 4, 1, col);
    fill(g, bx + bw - 12, y + 9 + i * 4, 6, 1, col);
  });
}

/** 한 자리에 물품 하나를 그린다(모르는 코드는 그리지 않는다) */
export function drawDecorItem(g: G, slot: SlotId, code: string) {
  const [x, y, w, h] = SLOTS[slot].box;
  const corner = w <= 16;
  switch (code) {
    case "PLANT":
      return plant(g, x + ((w - 16) >> 1), y + h - 24);
    case "FAN":
      return fan(g, x + ((w - 16) >> 1), y + h - 24);
    case "SCALE":
      return scale(g, x, y + h - 24, w);
    case "CLOCK":
      return clock(g, x, y, w);
    case "BANNER":
      return banner(g, x, y, w);
    case "TROPHY":
      return trophy(g, x, y, w, h, y < 10);
    case "KETTLEBELL":
      return kettlebells(g, x, y, w, h);
    case "SMITH":
      return smith(g, x, y, w, h);
    case "BENCH":
      return bench(g, x, y, w, h);
    case "BIKE":
      return bike(g, x, y, w, h);
    case "FRIDGE":
      return fridge(g, x, y, w, h);
    case "PROTEIN":
      return protein(g, x, y, w, h, slot === "COUNTER" || slot.startsWith("DN_COUNTER") || corner);
    case "YOGA_MAT":
      return yogaMat(g, x, y, h);
    case "SANDBAG":
      return sandbag(g, x, y, w, h);
    case "PULLUP_BAR":
      return pullupBar(g, x, y, w, h);
    case "CONE":
      return cones(g, x, y, w, h);
    case "WATER_STATION":
      return waterStation(g, x, y, w, h);
    case "FINISH_FLAG":
      return finishFlag(g, x, y, w, h);
    case "RICE_COOKER":
      return riceCooker(g, x, y, w, h);
    case "SALAD_BAR":
      return saladBar(g, x, y, w, h);
    case "MENU_BOARD":
      return menuBoard(g, x, y, w);
    case "RING_RED":
      return ring(g, x, y, w, h, "#3E1C19", "#35201D");
    case "RING_YELLOW":
      return ring(g, x, y, w, h, "#4A3A12", "#3A2E10");
  }
}

/** 그 공간에 놓인 물품 전부 */
export function paintDecor(g: G, layout: DecorLayout, scene: SceneId = "MAIN") {
  for (const id of SLOT_IDS) {
    if (SLOTS[id].scene !== scene) continue;
    const code = layout[id];
    if (code) drawDecorItem(g, id, code);
  }
}

/** 고르는 창 미리보기: 그 자리 크기의 작은 캔버스에 그 물품만 */
export function paintPreview(canvas: HTMLCanvasElement, slot: SlotId, code: string) {
  const [x, y, w, h] = SLOTS[slot].box;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.fillStyle = y < 10 ? "#34363C" : SLOTS[slot].scene === "TRACK" ? "#4C8C46" : SLOTS[slot].scene === "DINER" ? "#D8CDB2" : "#232428";
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(-x, -y);
  drawDecorItem(g, slot, code);
  g.restore();
}

/** 그 공간에서 물품이 놓여 막힌 칸들 */
export function solidTiles(layout: DecorLayout, scene: SceneId = "MAIN"): Rect[] {
  return SLOT_IDS.filter((id) => SLOTS[id].scene === scene && layout[id] && SLOTS[id].solid).map((id) => SLOTS[id].solid as Rect);
}
