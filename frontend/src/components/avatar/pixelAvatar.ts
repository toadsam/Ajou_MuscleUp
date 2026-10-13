// 짐 플로어(v2) 픽셀 아바타 — 24×32 그리드에 리프터를 그린다.
//
// 그리는 순서: 몸(뒤→앞) → 자동 외곽선(빈 칸 중 몸에 맞닿은 곳을 검정으로) → 효과(외곽선 없음).
// 좌표는 칸 단위, 몸은 0..23 열 / 0..31 행 안에 그린다. 머리 위로 든 바벨과 원판은
// 그 바깥(음수 행, -16..39 열)까지 나가고, SVG overflow 로 보인다.
// 몸은 11/12 열 사이를 축으로 좌우 대칭이라 왼쪽만 그리고 거울로 복사한다.
//
// 운동 동작(spec.action): 운동 세션에서 지금 종목의 동작을 두 프레임(0 시작 자세 · 1 힘주는 자세)으로 그린다.
// 정면: 스쿼트 · 데드리프트 · 프레스 · 컬 · 레이즈 · 플라이 · 턱걸이 · 레그 레이즈 · 알통.
// 옆모습(buildSideArt): 벤치프레스 · 푸시업 — 정면으로는 누운 자세가 안 보여서.
// 바벨 원판은 실제 무게대로(plates, 무거운 것이 안쪽) 국제 규격 색으로 끼운다.

export const GRID_W = 24;
export const GRID_TOP = -5;
export const GRID_LEFT = -16;
export const GRID_RIGHT = 39;
export const GRID_BOTTOM = 31;
export const CELL = 6; // viewBox 144×192 = 24×32 칸

export const INK = "#0E0E10";

export type Pose = "stand" | "flex" | "overhead";
export type Risk = "normal" | "warning" | "critical";

export type ActionKind =
  | "squat"
  | "deadlift"
  | "press"
  | "curl"
  | "raise"
  | "fly"
  | "pullup"
  | "legraise"
  | "bench"
  | "pushup"
  | "flex";
/** barbell 은 원판을 끼우고, dumbbell 은 손에 덤벨, machine · none 은 맨손 */
export type Equip = "barbell" | "dumbbell" | "machine" | "none";
/** 원판 한 장: size 0 큰 원판(10kg 이상) · 1 5kg · 2 그보다 작은 것 */
export type PixelPlate = { color: string; size: 0 | 1 | 2 };
export type PixelAction = { kind: ActionKind; frame: 0 | 1; equip: Equip; plates: PixelPlate[] };

export type PixelAvatarSpec = {
  /** 근육 단계 0(마름) ~ 3(거구) */
  build: 0 | 1 | 2 | 3;
  /** 체지방이 높으면 1 */
  fat: 0 | 1;
  female: boolean;
  /** 시드에서 고른 머리 모양 0..3 */
  hairStyle: number;
  /** 시드에서 고른 눈 모양 0..2 */
  eyeStyle: number;
  pose: Pose;
  /** 티어 0(BRONZE) ~ 7(CHALLENGER) — 장비가 하나씩 늘어난다 */
  tierStep: number;
  /** 머리 위 바벨에 끼운 원판 수(한쪽) 0..3 */
  plates: number;
  resting: boolean;
  risk: Risk;
  colors: {
    skin: string;
    hair: string;
    tank: string;
  };
  /** 진화 갈래 시그니처 마크 색 (없으면 안 그림) */
  emblem: string | null;
  /** 운동 동작(있으면 pose · plates 대신) */
  action?: PixelAction | null;
  skills: {
    aura: boolean;
    wave: boolean;
    burst: boolean;
  };
};

export type PixelRun = { x: number; y: number; w: number; color: string };
export type PixelEffect = { x: number; y: number; w: number; h: number; color: string; className: string; delay: number };

export type PixelAvatarArt = {
  runs: PixelRun[];
  effects: PixelEffect[];
  /** 꾸미기 이미지를 덮을 영역(칸 단위) */
  regions: {
    face: { x: number; y: number; w: number; h: number };
    body: { x: number; y: number; w: number; h: number };
    emblem: { x: number; y: number; w: number; h: number };
  };
};

const PLATE_COLORS = ["#D9302A", "#2F6FD0", "#F0BE2E"];
const BAR = "#9A9DA3";
const COLLAR = "#B8BBC0";
const IRON = "#5B5F68";
/** 한쪽에 그릴 원판 수 상한(그 이상은 화면 글자로) */
const MAX_PIXEL_PLATES = 8;

const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * (1 - amount))));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

class Grid {
  private rows = GRID_BOTTOM - GRID_TOP + 1;
  private cols = GRID_RIGHT - GRID_LEFT + 1;
  cells: (string | null)[][] = Array.from({ length: this.rows }, () => Array<string | null>(this.cols).fill(null));
  /** 그리는 위치를 위아래로 옮긴다(스쿼트로 앉기 · 턱걸이로 올라가기). 외곽선 전에 0 으로 */
  oy = 0;

  private inside(x: number, y: number) {
    return x >= GRID_LEFT && x <= GRID_RIGHT && y >= GRID_TOP && y <= GRID_BOTTOM;
  }

  get(x: number, y: number) {
    return this.inside(x, y) ? this.cells[y - GRID_TOP][x - GRID_LEFT] : null;
  }

  set(x: number, y: number, color: string | null) {
    const yy = y + this.oy;
    if (this.inside(x, yy)) this.cells[yy - GRID_TOP][x - GRID_LEFT] = color;
  }

  /** 양 끝 포함 사각형 */
  rect(x0: number, x1: number, y0: number, y1: number, color: string | null) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) this.set(x, y, color);
  }

  /** 왼쪽 반을 그리고 오른쪽에 거울로 복사 */
  mirrorRect(x0: number, x1: number, y0: number, y1: number, color: string | null) {
    this.rect(x0, x1, y0, y1, color);
    this.rect(GRID_W - 1 - x1, GRID_W - 1 - x0, y0, y1, color);
  }

  mirrorSet(x: number, y: number, color: string | null) {
    this.set(x, y, color);
    this.set(GRID_W - 1 - x, y, color);
  }

  /** 가운데를 축으로 반폭 hw 만큼 가로 띠 */
  band(hw: number, y0: number, y1: number, color: string | null) {
    this.rect(12 - hw, 11 + hw, y0, y1, color);
  }

  outline() {
    this.oy = 0;
    const marks: [number, number][] = [];
    for (let y = GRID_TOP; y <= GRID_BOTTOM; y += 1) {
      for (let x = GRID_LEFT; x <= GRID_RIGHT; x += 1) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) marks.push([x, y]);
      }
    }
    marks.forEach(([x, y]) => this.set(x, y, INK));
  }

  runs(): PixelRun[] {
    const out: PixelRun[] = [];
    for (let y = GRID_TOP; y <= GRID_BOTTOM; y += 1) {
      let x = GRID_LEFT;
      while (x <= GRID_RIGHT) {
        const color = this.get(x, y);
        if (!color) {
          x += 1;
          continue;
        }
        let w = 1;
        while (x + w <= GRID_RIGHT && this.get(x + w, y) === color) w += 1;
        out.push({ x, y, w, color });
        x += w;
      }
    }
    return out;
  }
}

type Palette = {
  skin: string;
  skinShade: string;
  hair: string;
  tank: string;
  tankShade: string;
  chalk: string;
  handColor: string;
  wraps: string;
  shorts: string;
  shoe: string;
  headband: string;
};

function paletteFor(spec: PixelAvatarSpec): Palette {
  const tier = spec.tierStep;
  const tank = spec.colors.tank;
  const chalk = "#F4F2EC";
  const chalkHands = tier >= 5 || (!spec.action && spec.pose === "overhead") || spec.action?.equip === "barbell";
  return {
    skin: spec.colors.skin,
    skinShade: shade(spec.colors.skin, 0.14),
    hair: spec.colors.hair,
    tank,
    tankShade: shade(tank, 0.22),
    chalk,
    handColor: chalkHands ? chalk : spec.colors.skin,
    wraps: "#EEECE6",
    shorts: "#2B3A67",
    shoe: tier >= 7 ? "#F0BE2E" : "#E8E6E0",
    headband: tank.toUpperCase() === "#D9302A" ? "#2F6FD0" : "#D9302A",
  };
}

type Box = { x0: number; x1: number; y0: number; y1: number };
type ArmStyle = "stand" | "flex" | "overhead" | "rack" | "rackLow" | "curl" | "wide" | "front" | "hang";

/** 같은 색 원판이 이어지면 한 장씩 어둡게 번갈아 칠해 몇 장인지 보이게 한다 */
function plateColors(plates: PixelPlate[]) {
  let run = 0;
  return plates.map((p, i) => {
    run = i > 0 && plates[i - 1].color === p.color ? run + 1 : 0;
    return run % 2 === 1 ? shade(p.color, 0.3) : p.color;
  });
}

/** 정면 바벨: y 행에 봉, xIn 열(왼쪽 안쪽 원판의 오른쪽 끝)부터 바깥으로 무거운 원판부터 끼운다 */
function drawBar(g: Grid, y: number, xIn: number, plates: PixelPlate[]) {
  const list = plates.slice(0, MAX_PIXEL_PLATES);
  const widths = list.map((p) => (p.size === 0 ? 2 : 1));
  const total = widths.reduce((a, w) => a + w, 0);
  const colors = plateColors(list);
  g.mirrorRect(xIn - total - 1, 11, y, y, BAR); // 봉(원판 바깥으로 슬리브가 한 칸 나온다)
  let x = xIn;
  list.forEach((p, i) => {
    const h = p.size === 0 ? 3 : p.size === 1 ? 2 : 1;
    g.mirrorRect(x - widths[i] + 1, x, y - h, y + h, colors[i]);
    x -= widths[i];
  });
  g.mirrorRect(xIn + 1, xIn + 1, y - 1, y + 1, COLLAR);
}

export function buildPixelAvatar(spec: PixelAvatarSpec): PixelAvatarArt {
  const act = spec.action ?? null;
  const pal = paletteFor(spec);
  if (act && (act.kind === "bench" || act.kind === "pushup")) return buildSideArt(spec, act, pal);

  const g = new Grid();
  const { build: b, fat, tierStep: tier, pose } = spec;
  const { skin, skinShade, hair, tank, tankShade, chalk, handColor, wraps, shorts, shoe, headband } = pal;

  // ---- 치수 ----
  const hwShoulder = 4 + b; // 어깨 반폭
  const hwChest = Math.max(4, 3 + b);
  const hwWaist = 4 + (b >= 3 ? 1 : 0) + fat;
  const hwShorts = 4 + (b >= 3 ? 1 : 0) + fat;
  const armT = 2 + (b >= 2 ? 1 : 0) + (b >= 3 ? 1 : 0); // 팔 두께
  const legW = 2 + (b >= 2 ? 1 : 0) + (b >= 3 ? 1 : 0);
  const xs = 12 - hwShoulder; // 왼쪽 어깨 끝 열

  // ---- 운동 동작 ----
  const kind = act?.kind ?? null;
  const f = act?.frame ?? 0;
  const equip = act?.equip ?? "none";
  // 프레임 1: 스쿼트 · 데드는 몸을 내리고(행 +), 턱걸이는 올린다(행 -)
  const drop = f === 1 ? (kind === "squat" ? 3 : kind === "deadlift" ? 2 : kind === "pullup" ? -5 : 0) : 0;
  const bentLegs = f === 1 && (kind === "squat" || kind === "deadlift");
  const ARMS: Record<ActionKind, [ArmStyle, ArmStyle]> = {
    squat: equip === "barbell" ? ["rack", "rack"] : ["stand", "stand"],
    deadlift: ["stand", "stand"],
    press: ["rackLow", "overhead"],
    curl: ["stand", "curl"],
    raise: ["stand", "wide"],
    fly: ["wide", "front"],
    pullup: ["hang", "hang"],
    legraise: ["hang", "hang"],
    flex: ["stand", "flex"],
    bench: ["stand", "stand"],
    pushup: ["stand", "stand"],
  };
  const arms: ArmStyle = kind ? ARMS[kind][f] : pose;

  // 팔 모양: 팔(segs)과 손(hand)의 왼쪽 칸. 오른쪽은 거울
  const overheadX1 = Math.min(5, xs + 1); // 귀(7열)와 붙지 않게 5열까지
  const overheadX0 = Math.max(3, overheadX1 - armT + 1);
  const armBoxes = (): { segs: Box[]; hand: Box; wrap: number | null } => {
    const ax0 = xs - armT;
    switch (arms) {
      case "flex": {
        const ox0 = Math.max(1, xs - 2 - armT);
        const ox1 = ox0 + armT - 1;
        const segs: Box[] = [
          { x0: ox0, x1: xs - 1, y0: 13, y1: 13 + armT - 1 }, // 위팔(가로)
          { x0: ox0, x1: ox1, y0: 7, y1: 12 }, // 아래팔(세로)
        ];
        if (b >= 1 && ox1 + 1 <= xs - 1) segs.push({ x0: ox1 + 1, x1: Math.min(ox1 + 2, xs - 1), y0: 11, y1: 12 }); // 알통
        return { segs, hand: { x0: ox0, x1: ox1, y0: 5, y1: 6 }, wrap: 7 };
      }
      case "overhead":
        return { segs: [{ x0: overheadX0, x1: overheadX1, y0: 2, y1: 13 }], hand: { x0: overheadX0, x1: overheadX1, y0: -2, y1: 1 }, wrap: 2 };
      case "hang":
        // 매달리기: 손은 철봉에 고정, 팔은 어깨까지(몸이 올라가면 짧아진다)
        return { segs: [{ x0: overheadX0, x1: overheadX1, y0: 1, y1: 13 + drop }], hand: { x0: overheadX0, x1: overheadX1, y0: -2, y1: 0 }, wrap: 1 };
      case "rack":
        // 바를 등(어깨 위)에 메고 손은 귀 옆
        return { segs: [{ x0: ax0, x1: xs - 1, y0: 12, y1: 15 }], hand: { x0: ax0, x1: xs - 1, y0: 10, y1: 11 }, wrap: 12 };
      case "rackLow":
        // 바를 쇄골 앞에
        return { segs: [{ x0: ax0, x1: xs - 1, y0: 13, y1: 15 }], hand: { x0: ax0, x1: xs - 1, y0: 11, y1: 12 }, wrap: null };
      case "curl": {
        // 아래팔이 앞으로 올라와 손이 어깨 앞에
        const segs: Box[] = [{ x0: ax0, x1: xs - 1, y0: 15, y1: 19 }];
        if (b >= 1) segs.push({ x0: ax0 - 1, x1: ax0 - 1, y0: 15, y1: 17 }); // 알통
        return { segs, hand: { x0: ax0, x1: xs - 1, y0: 13, y1: 14 }, wrap: null };
      }
      case "wide": {
        const ox0 = xs - 7;
        return {
          segs: [{ x0: ox0, x1: xs - 1, y0: 13, y1: 13 + Math.min(armT, 3) - 1 }],
          hand: { x0: ox0 - 2, x1: ox0 - 1, y0: 13, y1: 14 },
          wrap: null,
        };
      }
      case "front":
        // 두 손을 가슴 앞에서 모은다
        return {
          segs: [
            { x0: xs - 2, x1: xs - 1, y0: 13, y1: 15 },
            { x0: xs - 2, x1: 9, y0: 15, y1: 16 },
          ],
          hand: { x0: 10, x1: 11, y0: 14, y1: 16 },
          wrap: null,
        };
      default: {
        const segs: Box[] = [{ x0: ax0, x1: xs - 1, y0: 14, y1: 21 }];
        if (b >= 2 && ax0 - 1 >= 1) segs.push({ x0: ax0 - 1, x1: ax0 - 1, y0: 15, y1: 16 }); // 이두
        return { segs, hand: { x0: ax0, x1: xs - 1, y0: 22, y1: 23 }, wrap: 21 };
      }
    }
  };
  const armArt = armBoxes();
  const hand = armArt.hand;
  const barXIn = Math.min(1, hand.x0 - 2);
  const plates = act?.plates ?? [];
  // 바벨이 몸 뒤(등에 멘 스쿼트 · 머리 위)인지 앞(데드 · 프레스 시작 · 컬)인지
  const barBehind = equip === "barbell" && (arms === "rack" || arms === "overhead");
  const barFront = equip === "barbell" && (arms === "stand" || arms === "rackLow" || arms === "curl");
  const barRow = arms === "overhead" ? -1 : hand.y0 + 1;

  // ---- 바벨(뒤) — 팔보다 먼저 그려서 손이 봉을 쥐게 ----
  if (!act && pose === "overhead") {
    const n = Math.max(1, Math.min(3, spec.plates));
    g.mirrorRect(-2 * n, 11, -1, -1, BAR); // 봉(원판 바깥으로 슬리브가 조금 나온다)
    for (let i = 0; i < n; i += 1) {
      // 두께 2칸 원판, 무거운 빨강이 안쪽
      g.mirrorRect(1 - 2 * i - 1, 1 - 2 * i, -4, 2, PLATE_COLORS[i]);
    }
    g.mirrorRect(2, 2, -2, 0, COLLAR); // 칼라
  }
  if (kind === "pullup" || kind === "legraise") g.rect(-6, 29, -1, -1, BAR); // 철봉(몸이 움직여도 그대로)
  g.oy = arms === "overhead" ? 0 : drop;
  if (barBehind) drawBar(g, barRow, barXIn, plates);

  // ---- 다리 · 신발 ----
  const legX0 = 11 - legW;
  if (bentLegs) {
    // 정면에서 본 앉은 자세: 반바지 바로 아래 무릎이 바깥으로, 정강이는 짧게
    g.oy = 0;
    const top = 24 + drop;
    g.mirrorRect(legX0 - 2, 9, top, top, skin);
    g.mirrorRect(legX0 - 2, legX0 - 3 + legW, top, 28, skin);
    g.mirrorRect(legX0 - 3, legX0 - 3 + legW, 29, 30, shoe);
  } else if (kind === "legraise" && f === 1) {
    // 무릎을 앞으로 들어 올려 다리가 짧아 보이고 신발 바닥이 보인다
    g.oy = 0;
    g.mirrorRect(legX0, 10, 25, 26, skin);
    g.mirrorRect(legX0 - 1, 10, 27, 28, shoe);
  } else {
    // 턱걸이로 올라가면 다리도 같이 올라간다
    g.oy = kind === "pullup" ? drop : 0;
    g.mirrorRect(legX0, 10, 25, 28, skin);
    if (tier >= 3) g.mirrorRect(legX0, 10, 26, 27, "#3A3D43"); // 무릎 보호대
    g.mirrorRect(legX0 - 1, 10, 29, 30, shoe);
  }
  g.oy = drop;

  // ---- 반바지 ----
  if (bentLegs) {
    g.band(hwShorts, 21, 23, shorts);
    g.rect(11, 12, 23, 23, null); // 가랑이
  } else {
    g.band(hwShorts, 21, 24, shorts);
    g.rect(11, 12, 24, 24, null); // 가랑이
  }

  // ---- 몸통(민소매) ----
  g.band(hwShoulder, 13, 14, tank);
  g.band(hwChest, 15, 17, tank);
  g.band(hwWaist + (fat ? 1 : 0), 18, 19, tank);
  g.band(hwWaist, 20, 20, tank);
  // 어깨(삼각근)는 살
  const delt = b >= 1 ? 2 : 1;
  g.mirrorRect(xs, xs + delt - 1, 13, 14, skin);
  if (b >= 1) g.mirrorRect(12 - hwChest, 12 - hwChest, 15, 15, skin);
  // 목 · 목선
  g.rect(b >= 2 ? 9 : 10, b >= 2 ? 14 : 13, 12, 12, skin);
  g.rect(10, 13, 13, 13, skin);
  // 가슴 음영
  if (b >= 2) g.band(hwChest - 1, 17, 17, tankShade); // 가슴 아래 음영 한 줄
  // 벨트
  if (tier >= 6) {
    g.band(hwWaist, 20, 20, "#F0BE2E");
    g.rect(10, 13, 19, 21, "#F0BE2E");
    g.rect(11, 12, 20, 20, "#B5850E");
  } else if (tier >= 2) {
    g.band(hwWaist, 20, 20, "#6B4A2E");
    g.rect(11, 12, 20, 20, tier >= 5 ? "#F0BE2E" : "#B8BBC0");
  }
  // 수건(휴식)
  if (spec.resting) {
    g.rect(xs, xs + 2, 13, 18, "#EEECE6");
  }

  // ---- 팔 ----
  // 매달린 팔과 머리 위로 든 손은 바에 붙어 있어 몸과 같이 움직이지 않는다
  if (arms === "hang" || arms === "overhead") g.oy = 0;
  armArt.segs.forEach((s) => g.mirrorRect(s.x0, s.x1, s.y0, s.y1, skin));
  if (tier >= 1 && armArt.wrap !== null) g.mirrorRect(hand.x0, hand.x1, armArt.wrap, armArt.wrap, wraps);
  g.mirrorRect(hand.x0, hand.x1, hand.y0, hand.y1, handColor);
  if (barFront) {
    drawBar(g, barRow, barXIn, plates);
    g.mirrorRect(hand.x0, hand.x1, hand.y0, hand.y1, handColor); // 봉 위로 주먹
  }
  if (equip === "dumbbell" && arms !== "hang") {
    // 덤벨(손잡이를 세로로 쥔 모양): 주먹 위아래로 쇳덩이
    g.mirrorRect(hand.x0, hand.x1, hand.y0 - 2, hand.y0 - 1, IRON);
    g.mirrorRect(hand.x0, hand.x1, hand.y1 + 1, hand.y1 + 2, IRON);
  }
  g.oy = drop;

  // ---- 머리 ----
  g.rect(8, 15, 4, 11, skin);
  g.mirrorSet(8, 4, null);
  g.mirrorSet(8, 11, null);
  g.mirrorRect(7, 7, 7, 8, skin); // 귀

  // 머리카락
  const style = spec.hairStyle % 4;
  if (spec.female) {
    g.rect(8, 15, 3, 5, hair);
    g.mirrorSet(8, 3, null);
    if (style % 2 === 0) {
      g.mirrorRect(7, 7, 4, 10, hair); // 긴 옆머리
    } else {
      g.rect(16, 17, 4, 9, hair); // 포니테일
      g.rect(17, 18, 6, 10, hair);
    }
    g.rect(12, 15, 6, 6, hair); // 앞머리
  } else if (style === 0) {
    g.rect(8, 15, 3, 4, hair); // 짧은 머리
    g.mirrorSet(8, 3, null);
  } else if (style === 1) {
    g.rect(8, 15, 3, 4, hair); // 삐죽 머리
    g.mirrorSet(8, 3, null);
    [9, 11, 14].forEach((x) => g.set(x, 2, hair));
  } else if (style === 2) {
    g.rect(8, 15, 2, 4, hair); // 플랫탑
  } else {
    g.rect(8, 15, 3, 4, hair); // 옆으로 넘긴 앞머리
    g.mirrorSet(8, 3, null);
    g.rect(8, 11, 5, 5, hair);
    g.set(7, 4, hair);
  }
  if (tier >= 4) g.rect(8, 15, 5, 5, headband);

  // 얼굴
  if (spec.resting) {
    g.rect(9, 10, 7, 7, INK);
    g.rect(13, 14, 7, 7, INK);
  } else {
    g.set(10, 7, INK);
    g.set(13, 7, INK);
    if (spec.eyeStyle === 1) {
      g.set(10, 8, INK);
      g.set(13, 8, INK);
    }
    if (spec.eyeStyle === 2 || spec.risk !== "normal") {
      g.set(spec.risk !== "normal" ? 9 : 10, 6, INK);
      g.set(spec.risk !== "normal" ? 14 : 13, 6, INK);
    }
  }
  if (spec.risk !== "normal" && !spec.resting) {
    g.set(10, 10, INK);
    g.rect(11, 12, 9, 9, INK);
    g.set(13, 10, INK); // 처진 입
  } else if (act ? act.frame === 1 && act.kind !== "flex" : pose === "overhead") {
    g.rect(11, 12, 9, 10, INK); // 힘주는 입
  } else if ((act ? act.kind === "flex" && act.frame === 1 : pose === "flex") || tier >= 5) {
    g.set(10, 9, INK);
    g.rect(11, 12, 10, 10, INK);
    g.set(13, 9, INK); // 웃음
  } else {
    g.rect(11, 12, 9, 9, INK);
  }
  g.mirrorSet(9, 9, skinShade); // 볼

  g.outline();

  // ---- 효과(외곽선 없음) ----
  const effects: PixelEffect[] = [];
  const fx = (x: number, y: number, color: string, className: string, delay = 0, w = 1, h = 1) =>
    effects.push({ x, y, w, h, color, className, delay });

  if (spec.emblem) {
    const mark = spec.emblem.toUpperCase() === tank.toUpperCase() ? chalk : spec.emblem;
    fx(11, 15, mark, "", 0, 2, 2);
  }
  if (spec.risk !== "normal" && !spec.resting) {
    fx(17, 4, "#7EA7E9", "pxa-sweat", 0, 1, 2);
    if (spec.risk === "critical") fx(5, 6, "#7EA7E9", "pxa-sweat", 400, 1, 2);
  }
  if (spec.resting) {
    fx(18, 1, chalk, "pxa-zz", 0, 3, 1);
    fx(19, 2, chalk, "pxa-zz", 0, 1, 1);
    fx(18, 3, chalk, "pxa-zz", 0, 3, 1);
  }
  if (spec.skills.aura) {
    [
      [2, 12],
      [21, 9],
      [3, 20],
      [20, 18],
      [1, 26],
      [22, 25],
    ].forEach(([x, y], i) => fx(x, y, chalk, "pxa-dust", i * 260));
  }
  if (spec.skills.wave) {
    fx(1, 31, "#F0BE2E", "pxa-wave", 0, 4, 1);
    fx(19, 31, "#F0BE2E", "pxa-wave", 0, 4, 1);
  }
  if (spec.skills.burst) {
    [
      [2, 4],
      [21, 14],
      [1, 17],
    ].forEach(([x, y], i) => {
      fx(x, y - 1, "#F0BE2E", "pxa-spark", i * 300);
      fx(x - 1, y, "#F0BE2E", "pxa-spark", i * 300, 3, 1);
      fx(x, y + 1, "#F0BE2E", "pxa-spark", i * 300);
    });
  }

  return {
    runs: g.runs(),
    effects,
    regions: {
      face: { x: 9, y: 6, w: 6, h: 5 },
      body: { x: 12 - hwChest, y: 13, w: hwChest * 2, h: 8 },
      emblem: { x: 10, y: 15, w: 4, h: 3 },
    },
  };
}

/** 옆에서 본 원판(팔각형). x0, y0 은 왼쪽 위, size 는 짝수 */
function disc(g: Grid, x0: number, y0: number, size: number, color: string) {
  const cut = size >= 8 ? 2 : size >= 6 ? 1 : 0;
  for (let dy = 0; dy < size; dy += 1) {
    const inset = Math.max(0, cut - Math.min(dy, size - 1 - dy));
    g.rect(x0 + inset, x0 + size - 1 - inset, y0 + dy, y0 + dy, color);
  }
}

/** 옆모습(머리가 왼쪽): 벤치프레스 · 푸시업. 정면 그림과 같은 색 · 같은 외곽선 규칙 */
function buildSideArt(spec: PixelAvatarSpec, act: PixelAction, pal: Palette): PixelAvatarArt {
  const g = new Grid();
  const { skin, hair, tank, shorts, shoe, handColor } = pal;
  const b = spec.build;
  const tier = spec.tierStep;
  const f = act.frame;
  let face = { x: 1, y: 15, w: 5, h: 6 };

  if (act.kind === "bench") {
    // 벤치
    g.rect(4, 5, 23, 30, "#8E9197");
    g.rect(15, 16, 23, 30, "#8E9197");
    g.rect(2, 17, 21, 22, "#3A3D43");
    // 다리: 무릎을 세우고 발은 바닥에
    g.rect(18, 21, 17, 19, skin);
    g.rect(20, 21, 20, 28, skin);
    g.rect(20, 23, 29, 30, shoe);
    // 몸통 · 반바지 · 벨트
    g.rect(7, 14, b >= 2 ? 16 : 17, 20, tank);
    g.rect(15, 18, 17, 20, shorts);
    if (tier >= 2) g.rect(14, 14, 17, 20, tier >= 6 ? "#F0BE2E" : "#6B4A2E");
    // 목 · 머리(얼굴이 위, 뒤통수가 벤치에)
    g.rect(6, 6, 18, 20, skin);
    g.rect(1, 5, 15, 20, skin);
    g.rect(1, 1, 15, 20, hair);
    g.rect(1, 5, 20, 20, hair);
    g.set(5, 15, null);
    g.set(3, 14, skin); // 코
    g.set(4, 16, spec.resting ? skin : INK); // 눈
    // 팔 · 바벨(프레임 1 은 팔을 다 편 자세)
    const hy = f === 1 ? 7 : 13;
    g.rect(10, 11, hy + 2, 17, skin);
    g.rect(10, 11, hy, hy + 1, handColor);
    // 원판: 옆에서 보면 원. 무거운 것(안쪽)부터 한 칸씩 비켜 겹쳐 가장자리 색이 보인다
    if (act.equip === "barbell") {
      const list = act.plates.slice(0, MAX_PIXEL_PLATES);
      const colors = plateColors(list);
      list.forEach((p, i) => {
        const size = p.size === 0 ? 8 : p.size === 1 ? 6 : 4;
        disc(g, 11 - size / 2 + i, hy + 1 - size / 2, size, colors[i]);
      });
      g.rect(10 + list.length, 11 + list.length, hy, hy + 1, COLLAR); // 봉 끝
    } else if (act.equip === "dumbbell") {
      disc(g, 9, hy - 1, 4, IRON);
    }
  } else {
    // 푸시업: 어깨(7열)에서 발(21열)까지 곧은 몸, 프레임 1 은 가슴이 바닥 가까이
    const sy = f === 1 ? 25 : 21;
    for (let x = 7; x <= 21; x += 1) {
      const yc = Math.round(sy + ((x - 7) * (27 - sy)) / 14);
      g.rect(x, x, yc - 1, yc + 1, x <= 13 ? tank : x <= 16 ? shorts : skin);
    }
    g.rect(21, 23, 28, 29, shoe);
    // 팔(앞쪽)과 손
    g.rect(7, 8, sy + 1, 28, skin);
    g.rect(6, 9, 29, 30, handColor);
    // 목 · 머리(아래를 본다)
    g.rect(6, 6, sy - 1, sy, skin);
    g.rect(1, 5, sy - 4, sy, skin);
    g.rect(1, 5, sy - 4, sy - 4, hair);
    g.rect(5, 5, sy - 4, sy - 2, hair);
    g.set(1, sy, null);
    g.set(2, sy - 2, spec.resting ? skin : INK); // 눈
    face = { x: 1, y: sy - 4, w: 5, h: 5 };
  }

  g.outline();
  return {
    runs: g.runs(),
    effects: [],
    regions: {
      face,
      body: { x: 7, y: 17, w: 8, h: 4 },
      emblem: { x: 9, y: 18, w: 3, h: 2 },
    },
  };
}
