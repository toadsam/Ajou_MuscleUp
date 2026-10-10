// 짐 플로어(v2) 픽셀 아바타 — 24×32 그리드에 리프터를 그린다.
//
// 그리는 순서: 몸(뒤→앞) → 자동 외곽선(빈 칸 중 몸에 맞닿은 곳을 검정으로) → 효과(외곽선 없음).
// 좌표는 칸 단위, 몸은 0..23 열 / 0..31 행 안에 그린다. 머리 위로 든 바벨과 원판은
// 그 바깥(음수 행, -5..28 열)까지 나가고, SVG overflow 로 보인다.
// 몸은 11/12 열 사이를 축으로 좌우 대칭이라 왼쪽만 그리고 거울로 복사한다.

export const GRID_W = 24;
export const GRID_TOP = -5;
export const GRID_LEFT = -5;
export const GRID_RIGHT = 28;
export const GRID_BOTTOM = 31;
export const CELL = 6; // viewBox 144×192 = 24×32 칸

export const INK = "#0E0E10";

export type Pose = "stand" | "flex" | "overhead";
export type Risk = "normal" | "warning" | "critical";

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

  private inside(x: number, y: number) {
    return x >= GRID_LEFT && x <= GRID_RIGHT && y >= GRID_TOP && y <= GRID_BOTTOM;
  }

  get(x: number, y: number) {
    return this.inside(x, y) ? this.cells[y - GRID_TOP][x - GRID_LEFT] : null;
  }

  set(x: number, y: number, color: string | null) {
    if (this.inside(x, y)) this.cells[y - GRID_TOP][x - GRID_LEFT] = color;
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

export function buildPixelAvatar(spec: PixelAvatarSpec): PixelAvatarArt {
  const g = new Grid();
  const { build: b, fat, tierStep: tier, pose } = spec;
  const skin = spec.colors.skin;
  const skinShade = shade(skin, 0.14);
  const hair = spec.colors.hair;
  const tank = spec.colors.tank;
  const tankShade = shade(tank, 0.22);
  const chalk = "#F4F2EC";
  const handColor = tier >= 5 || pose === "overhead" ? chalk : skin;
  const wraps = "#EEECE6";
  const shorts = "#2B3A67";
  const headband = tank.toUpperCase() === "#D9302A" ? "#2F6FD0" : "#D9302A";

  // ---- 치수 ----
  const hwShoulder = 4 + b; // 어깨 반폭
  const hwChest = Math.max(4, 3 + b);
  const hwWaist = 4 + (b >= 3 ? 1 : 0) + fat;
  const hwShorts = 4 + (b >= 3 ? 1 : 0) + fat;
  const armT = 2 + (b >= 2 ? 1 : 0) + (b >= 3 ? 1 : 0); // 팔 두께
  const legW = 2 + (b >= 2 ? 1 : 0) + (b >= 3 ? 1 : 0);
  const xs = 12 - hwShoulder; // 왼쪽 어깨 끝 열

  // ---- 바벨(머리 위) — 팔보다 먼저 그려서 손이 봉을 쥐게 ----
  if (pose === "overhead") {
    const n = Math.max(1, Math.min(3, spec.plates));
    g.mirrorRect(-2 * n, 11, -1, -1, "#9A9DA3"); // 봉(원판 바깥으로 슬리브가 조금 나온다)
    for (let i = 0; i < n; i += 1) {
      // 두께 2칸 원판, 무거운 빨강이 안쪽
      g.mirrorRect(1 - 2 * i - 1, 1 - 2 * i, -4, 2, PLATE_COLORS[i]);
    }
    g.mirrorRect(2, 2, -2, 0, "#B8BBC0"); // 칼라
  }

  // ---- 다리 · 신발 ----
  const legX0 = 11 - legW;
  g.mirrorRect(legX0, 10, 25, 28, skin);
  if (tier >= 3) g.mirrorRect(legX0, 10, 26, 27, "#3A3D43"); // 무릎 보호대
  const shoe = tier >= 7 ? "#F0BE2E" : "#E8E6E0";
  g.mirrorRect(legX0 - 1, 10, 29, 30, shoe);

  // ---- 반바지 ----
  g.band(hwShorts, 21, 24, shorts);
  g.rect(11, 12, 24, 24, null); // 가랑이

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
  if (pose === "stand") {
    const ax0 = xs - armT;
    g.mirrorRect(ax0, xs - 1, 14, 21, skin);
    if (b >= 2 && ax0 - 1 >= 1) g.mirrorRect(ax0 - 1, ax0 - 1, 15, 16, skin); // 이두
    if (tier >= 1) g.mirrorRect(ax0, xs - 1, 21, 21, wraps);
    g.mirrorRect(ax0, xs - 1, 22, 23, handColor);
  } else if (pose === "flex") {
    const ox0 = Math.max(1, xs - 2 - armT);
    const ox1 = ox0 + armT - 1;
    g.mirrorRect(ox0, xs - 1, 13, 13 + armT - 1, skin); // 위팔(가로)
    g.mirrorRect(ox0, ox1, 7, 12, skin); // 아래팔(세로)
    if (b >= 1 && ox1 + 1 <= xs - 1) g.mirrorRect(ox1 + 1, Math.min(ox1 + 2, xs - 1), 11, 12, skin); // 알통
    if (tier >= 1) g.mirrorRect(ox0, ox1, 7, 7, wraps);
    g.mirrorRect(ox0, ox1, 5, 6, handColor); // 주먹
  } else {
    // 귀(7열)와 붙지 않게 5열까지, 바깥 원판·칼라와도 겹치지 않게
    const ax1 = Math.min(5, xs + 1);
    const ax0 = Math.max(3, ax1 - armT + 1);
    g.mirrorRect(ax0, ax1, 2, 13, skin);
    if (tier >= 1) g.mirrorRect(ax0, ax1, 2, 2, wraps);
    g.mirrorRect(ax0, ax1, -2, 1, handColor); // 봉을 쥔 손
  }

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
  } else if (pose === "overhead") {
    g.rect(11, 12, 9, 10, INK); // 힘주는 입
  } else if (pose === "flex" || tier >= 5) {
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
