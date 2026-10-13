// 픽셀 그림 공용 바탕 — 칸 그리드, 외곽선, 색, 원판. 정면 아바타(pixelAvatar)와 옆모습 동작(pixelPoses)이 같이 쓴다.
import type { PixelRun } from "./pixelAvatar";

export const GRID_W = 24;
export const GRID_TOP = -5;
export const GRID_LEFT = -16;
export const GRID_RIGHT = 39;
export const GRID_BOTTOM = 31;
export const CELL = 6; // viewBox 144×192 = 24×32 칸

export const INK = "#0E0E10";

export const PLATE_COLORS = ["#D9302A", "#2F6FD0", "#F0BE2E"];
export const BAR = "#9A9DA3";
export const COLLAR = "#B8BBC0";
export const IRON = "#5B5F68";
/** 한쪽에 그릴 원판 수 상한(그 이상은 화면 글자로) */
export const MAX_PIXEL_PLATES = 8;

export const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * (1 - amount))));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

export class Grid {
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

export type Palette = {
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

/** 같은 색 원판이 이어지면 한 장씩 어둡게 번갈아 칠해 몇 장인지 보이게 한다 */
export function plateColors(plates: { color: string }[]) {
  let run = 0;
  return plates.map((p, i) => {
    run = i > 0 && plates[i - 1].color === p.color ? run + 1 : 0;
    return run % 2 === 1 ? shade(p.color, 0.3) : p.color;
  });
}

/** 옆에서 본 원판(팔각형). x0, y0 은 왼쪽 위, size 는 짝수 */
export function disc(g: Grid, x0: number, y0: number, size: number, color: string) {
  const cut = size >= 8 ? 2 : size >= 6 ? 1 : 0;
  for (let dy = 0; dy < size; dy += 1) {
    const inset = Math.max(0, cut - Math.min(dy, size - 1 - dy));
    g.rect(x0 + inset, x0 + size - 1 - inset, y0 + dy, y0 + dy, color);
  }
}
