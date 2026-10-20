// 그림자 던전 지도(docs/design/shadow-dungeon-map.md 2절) — 위에서 내려다보는 픽셀 던전(캔버스).
//
// 20×36칸(한 칸 16px, 320×576). 화면에는 가로 13칸 정도가 보이고 카메라가 나를 따라간다(라운지 광장 plaza.ts 와 같은 방식).
// 아래(입구) → 방 A(잡몹 2 + 희귀 자리) → 가운데 방(잡몹 2, 기둥) → 위 보스 방(그림자). 아래 가운데 출구 매트에 서면 "나가기".
// 이동: 조이스틱 · 방향키 · WASD 는 누르는 동안 계속(84px/초), 바닥 탭은 길찾기, 몬스터 탭은 그 옆까지 걸어감.
// 몬스터는 2~4칸을 천천히 왕복할 뿐 쫓아오지 않는다. 닿으면 onEncounter(한 번), 멀어지면(28px) 다시 닿을 수 있다.
// React 는 HUD · 조이스틱 · 전투 창을 맡고, 이 파일은 그림 · 걷기 · 순찰 · 닿음만 맡는다. 전투 중(paused)엔 멈춘다.
import { drawChar, palOf, toneForMbti, walkPose, type Pal, type SpriteShape } from "../gymMap/engine";
import { artSize, drawMob } from "./mobArt";

export const TILE = 16;
export const COLS = 20;
export const ROWS = 36;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
const VIEW_COLS = 13;
const WALK = 84; // px/초
const PATROL = 20; // px/초
const MEET = 13; // px — 닿음
const REARM = 30; // px — 이만큼 멀어지면 다시 닿을 수 있음

const C = {
  ink: "#0E0E10",
  wall: "#2A2C31",
  wallTop: "#3C3E44",
  bolt: "#6B6E75",
  floor: "#17181B",
  floor2: "#1C1D21",
  chalk: "#F3F1EA",
  yellow: "#F0BE2E",
  red: "#D9302A",
  maple: "#5A3E2A",
  mapleTop: "#6E4C33",
  steel: "#9A9DA3",
  mat: "#2E9C55",
};

// ---- 지도 ----
type Rect = { c: number; r: number; w: number; h: number };
/** 걸을 수 있는 칸(방 · 복도) */
const ROOMS: Rect[] = [
  { c: 3, r: 2, w: 14, h: 8 }, // 보스 방
  { c: 9, r: 10, w: 2, h: 2 }, // 복도
  { c: 1, r: 12, w: 18, h: 8 }, // 가운데 방
  { c: 9, r: 20, w: 2, h: 2 }, // 복도
  { c: 2, r: 22, w: 16, h: 8 }, // 방 A
  { c: 9, r: 30, w: 2, h: 2 }, // 복도
  { c: 6, r: 32, w: 8, h: 3 }, // 입구
];
/** 방 안의 막힌 소품(기둥 · 랙 · 보스 무대 가장자리 아님) */
const PROPS: (Rect & { kind: "pillar" | "rack" | "bench" })[] = [
  { c: 9, r: 15, w: 2, h: 2, kind: "pillar" },
  { c: 2, r: 12, w: 2, h: 1, kind: "rack" },
  { c: 16, r: 12, w: 2, h: 1, kind: "rack" },
  { c: 2, r: 22, w: 1, h: 2, kind: "bench" },
  { c: 17, r: 22, w: 1, h: 2, kind: "bench" },
];
/** 보스 무대(원판 플랫폼, 걸을 수 있음) */
const STAGE: Rect = { c: 7, r: 3, w: 6, h: 4 };
/** 출구 매트 */
export const EXIT: Rect = { c: 8, r: 34, w: 4, h: 1 };
export const START: [number, number] = [10 * TILE, 33 * TILE + 8];
const BOSS_AT: [number, number] = [10 * TILE, 5 * TILE + 4];

/** 잡몹 자리(slot) → 순찰 두 끝(월드 픽셀, 발 위치) */
export const MOB_SLOTS: [number, number, number, number][] = [
  [5 * TILE, 25 * TILE, 8 * TILE, 25 * TILE], // 0 방 A 왼쪽
  [12 * TILE, 27 * TILE, 15 * TILE, 27 * TILE], // 1 방 A 오른쪽
  [3 * TILE, 15 * TILE, 6 * TILE, 15 * TILE], // 2 가운데 방 왼쪽
  [13 * TILE, 17 * TILE, 16 * TILE, 17 * TILE], // 3 가운데 방 오른쪽
  [4 * TILE, 28 * TILE, 4 * TILE, 26 * TILE], // 4 희귀 — 방 A 구석
];

const solid: number[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 1));
for (const q of ROOMS) for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) solid[r][c] = 0;
for (const q of PROPS) for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) solid[r][c] = 1;

const walkable = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && solid[r][c] === 0;
/** 발 자리(가로 ±4px · 세로 -3~0px)가 모두 걸을 수 있는지 */
const free = (x: number, y: number) =>
  walkable(Math.floor((x - 4) / TILE), Math.floor((y - 3) / TILE)) &&
  walkable(Math.floor((x + 4) / TILE), Math.floor((y - 3) / TILE)) &&
  walkable(Math.floor((x - 4) / TILE), Math.floor(y / TILE)) &&
  walkable(Math.floor((x + 4) / TILE), Math.floor(y / TILE));

function findPath(sc: number, sr: number, tc: number, tr: number): [number, number][] | null {
  if (!walkable(tc, tr)) return null;
  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>();
  const q: number[] = [key(sc, sr)];
  prev.set(q[0], -1);
  while (q.length) {
    const k = q.shift()!;
    const c = k % COLS;
    const r = Math.floor(k / COLS);
    if (c === tc && r === tr) {
      const out: [number, number][] = [];
      let cur = k;
      while (cur !== -1 && cur !== key(sc, sr)) {
        out.unshift([cur % COLS, Math.floor(cur / COLS)]);
        cur = prev.get(cur)!;
      }
      return out;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const nk = key(nc, nr);
      if (walkable(nc, nr) && !prev.has(nk)) {
        prev.set(nk, k);
        q.push(nk);
      }
    }
  }
  return null;
}

function nearestWalkable(c: number, r: number): [number, number] | null {
  for (let d = 1; d < 6; d++)
    for (let dr = -d; dr <= d; dr++)
      for (let dc = -d; dc <= d; dc++) if (walkable(c + dc, r + dr)) return [c + dc, r + dr];
  return null;
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fill = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/** 배경: 벽(볼트 철판) · 바닥(어두운 고무 매트 + 초크 점) · 보스 무대(메이플) · 소품 · 출구 매트 */
function paintDungeon(g: CanvasRenderingContext2D) {
  const rand = rng(91);
  fill(g, 0, 0, WORLD_W, WORLD_H, C.ink);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;
      if (solid[r][c] && !PROPS.some((p) => c >= p.c && c < p.c + p.w && r >= p.r && r < p.r + p.h)) {
        // 벽: 아래가 바닥이면 앞면(밝은 띠)
        const face = r + 1 < ROWS && !solid[r + 1][c];
        fill(g, x, y, TILE, TILE, face ? C.wallTop : C.wall);
        if (face) {
          fill(g, x, y + TILE - 4, TILE, 4, C.wall);
          fill(g, x + 3, y + 4, 2, 2, C.bolt);
          fill(g, x + 11, y + 4, 2, 2, C.bolt);
        } else if ((c + r) % 3 === 0) {
          fill(g, x + 7, y + 7, 2, 2, "#34363C");
        }
        continue;
      }
      fill(g, x, y, TILE, TILE, (c + r) % 2 ? C.floor : C.floor2);
      if (rand() < 0.25) fill(g, x + Math.floor(rand() * 14), y + Math.floor(rand() * 14), 1, 1, "#3A3B40");
      if (rand() < 0.06) fill(g, x + Math.floor(rand() * 13), y + Math.floor(rand() * 13), 2, 1, "#5B5C60");
    }
  // 보스 무대: 메이플 플랫폼 + 가운데 빨간 원
  fill(g, STAGE.c * TILE - 1, STAGE.r * TILE - 1, STAGE.w * TILE + 2, STAGE.h * TILE + 2, C.ink);
  fill(g, STAGE.c * TILE, STAGE.r * TILE, STAGE.w * TILE, STAGE.h * TILE, C.maple);
  for (let i = 0; i < STAGE.h * 2; i++) fill(g, STAGE.c * TILE, STAGE.r * TILE + i * 8, STAGE.w * TILE, 1, C.mapleTop);
  g.strokeStyle = C.red;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(BOSS_AT[0], BOSS_AT[1] - 2, 22, 11, 0, 0, Math.PI * 2);
  g.stroke();
  // 소품
  for (const p of PROPS) {
    const x = p.c * TILE;
    const y = p.r * TILE;
    const w = p.w * TILE;
    const h = p.h * TILE;
    fill(g, x - 1, y - 1, w + 2, h + 2, C.ink);
    if (p.kind === "pillar") {
      fill(g, x, y, w, h, C.wallTop);
      fill(g, x, y + h - 5, w, 5, C.wall);
      fill(g, x + 4, y + 4, 2, 2, C.bolt);
      fill(g, x + w - 6, y + 4, 2, 2, C.bolt);
    } else if (p.kind === "rack") {
      fill(g, x, y, w, h, "#24262B");
      fill(g, x + 2, y + 6, w - 4, 2, C.steel);
      for (let i = 0; i < 4; i++) fill(g, x + 4 + i * 7, y + 3, 3, 8, [C.red, "#2F6FD0", C.yellow, C.mat][i]);
    } else {
      fill(g, x, y, w, h, "#3A2A22");
      fill(g, x + 2, y + 2, w - 4, h - 4, "#4A362B");
    }
  }
  // 출구 매트(노랑 · 검정 줄)
  const ex = EXIT.c * TILE;
  const ey = EXIT.r * TILE;
  fill(g, ex, ey, EXIT.w * TILE, TILE, C.ink);
  for (let i = 0; i < EXIT.w * 4; i++) if (i % 2 === 0) fill(g, ex + i * 4, ey + 2, 4, TILE - 4, C.yellow);
}

// ---- 상대 ----
export type DungeonMob = { id: number; code: string; name: string; slot: number; hp: number; remaining: number; killed: boolean };
export type DungeonBoss = { name: string; hp: number; remaining: number; killed: boolean; rest: boolean };
export type EncounterTarget = { kind: "mob"; id: number } | { kind: "boss" };

type MobActor = DungeonMob & { x: number; y: number; dir: number; t: number; armed: boolean };

export type DungeonCallbacks = {
  onEncounter: (target: EncounterTarget) => void;
  /** 출구 매트 위에 섰는지 */
  onExitZone: (on: boolean) => void;
};

export type DungeonController = {
  setMobs: (mobs: DungeonMob[]) => void;
  setBoss: (boss: DungeonBoss) => void;
  /** 조이스틱 방향(-1~1). 0,0 이면 멈춤 */
  setStick: (x: number, y: number) => void;
  setPaused: (paused: boolean) => void;
  /** 전투가 끝나고 지도로 돌아올 때: 그 상대에서 한 걸음 물러선다 */
  stepBack: () => void;
  destroy: () => void;
  /** 내 캐릭터 모양(카드 그림과 같게) — 캐릭터 정보가 늦게 와도 지도를 다시 만들지 않고 바꾼다. 그림자 보스도 같은 모양 */
  setShape: (shape: SpriteShape | null) => void;
  /** 개발 확인용 */
  debug: () => { x: number; y: number; paused: boolean; mobs: { id: number; x: number; y: number; killed: boolean }[] };
  teleport: (x: number, y: number) => void;
};

export function createDungeon(canvas: HTMLCanvasElement, me: { mbti?: string | null; tank?: string | null; shape?: SpriteShape | null }, cb: DungeonCallbacks): DungeonController {
  const g = canvas.getContext("2d")!;
  const bg = document.createElement("canvas");
  bg.width = WORLD_W;
  bg.height = WORLD_H;
  paintDungeon(bg.getContext("2d")!);

  const tone = toneForMbti(me.mbti);
  const myTone = me.tank ? { ...tone, tank: me.tank } : tone;
  let myPal: Pal = palOf(myTone, me.shape);
  // 그림자 보스 = 나의 그림자: 같은 머리 · 몸, 어두운 색 · 빨간 눈(머리띠 · 볼은 없다)
  const shadowOf = (shape: SpriteShape | null | undefined): Pal => ({ h: "#1A1A1C", s: "#26272B", k: C.red, r: "#3A3D43", b: "#1F2024", w: "#3C3E44", shape: shape ? { ...shape, band: null } : null });
  let shadowPal: Pal = shadowOf(me.shape);

  const player = { x: START[0], y: START[1], path: [] as [number, number][], step: 0, back: true };
  let mobs: MobActor[] = [];
  let boss: DungeonBoss = { name: "그림자", hp: 100, remaining: 100, killed: false, rest: false };
  let bossArmed = true;
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let paused = false;
  let atExit = false;
  let raf = 0;
  let last = performance.now();
  let scale = 1;
  let cam = { x: 0, y: 0 };
  let tapMark: { x: number; y: number; t: number } | null = null;
  let lastTarget: { x: number; y: number } | null = null;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale = rect.width / (VIEW_COLS * TILE);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const goTile = (c: number, r: number) => {
    const target = walkable(c, r) ? [c, r] : nearestWalkable(c, r);
    if (!target) return;
    const path = findPath(Math.floor(player.x / TILE), Math.floor(player.y / TILE), target[0], target[1]);
    if (path) player.path = path;
  };

  const onPointer = (e: PointerEvent) => {
    if (paused) return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left) / scale + cam.x;
    const wy = (e.clientY - rect.top) / scale + cam.y;
    tapMark = { x: wx, y: wy, t: performance.now() };
    // 몬스터 · 보스를 누르면 그 앞까지
    for (const m of mobs) {
      if (!m.killed && Math.abs(wx - m.x) < 10 && wy > m.y - 18 && wy < m.y + 4) {
        goTile(Math.floor(m.x / TILE), Math.floor((m.y + TILE) / TILE));
        return;
      }
    }
    if (!boss.killed && Math.abs(wx - BOSS_AT[0]) < 10 && wy > BOSS_AT[1] - 20 && wy < BOSS_AT[1] + 4) {
      goTile(Math.floor(BOSS_AT[0] / TILE), Math.floor(BOSS_AT[1] / TILE) + 1);
      return;
    }
    goTile(Math.floor(wx / TILE), Math.floor(wy / TILE));
  };
  canvas.addEventListener("pointerdown", onPointer);

  const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!KEYS.includes(e.key)) return;
    e.preventDefault();
    const k = e.key.toLowerCase();
    if (e.type === "keydown") keys.add(k);
    else keys.delete(k);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  const input = () => {
    let x = stick.x;
    let y = stick.y;
    if (keys.has("arrowleft") || keys.has("a")) x -= 1;
    if (keys.has("arrowright") || keys.has("d")) x += 1;
    if (keys.has("arrowup") || keys.has("w")) y -= 1;
    if (keys.has("arrowdown") || keys.has("s")) y += 1;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  };

  const stepPlayer = (dt: number) => {
    const dir = input();
    if (Math.hypot(dir.x, dir.y) > 0.15) {
      player.path = [];
      const move = WALK * dt;
      const nx = player.x + dir.x * move;
      const ny = player.y + dir.y * move;
      if (free(nx, player.y)) player.x = nx;
      if (free(player.x, ny)) player.y = ny;
      player.back = dir.y < -0.3;
      player.step += dt;
      return true;
    }
    if (!player.path.length) return false;
    const [c, r] = player.path[0];
    const tx = c * TILE + 8;
    const ty = r * TILE + 12;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const dist = Math.hypot(dx, dy);
    const move = WALK * dt;
    if (dist <= move) {
      player.x = tx;
      player.y = ty;
      player.path.shift();
    } else {
      player.x += (dx / dist) * move;
      player.y += (dy / dist) * move;
    }
    player.back = dy < -0.3;
    player.step += dt;
    return true;
  };

  const stepMobs = (dt: number) => {
    for (const m of mobs) {
      if (m.killed) continue;
      const s = MOB_SLOTS[m.slot] ?? MOB_SLOTS[0];
      m.t += dt * m.dir * (PATROL / Math.max(1, Math.hypot(s[2] - s[0], s[3] - s[1])));
      if (m.t >= 1) {
        m.t = 1;
        m.dir = -1;
      } else if (m.t <= 0) {
        m.t = 0;
        m.dir = 1;
      }
      m.x = s[0] + (s[2] - s[0]) * m.t;
      m.y = s[1] + (s[3] - s[1]) * m.t;
    }
  };

  const checkMeet = () => {
    for (const m of mobs) {
      if (m.killed) continue;
      const d = Math.hypot(player.x - m.x, player.y - m.y);
      if (d > REARM) m.armed = true;
      if (m.armed && d < MEET) {
        m.armed = false;
        lastTarget = { x: m.x, y: m.y };
        player.path = [];
        cb.onEncounter({ kind: "mob", id: m.id });
        return;
      }
    }
    if (!boss.killed) {
      const d = Math.hypot(player.x - BOSS_AT[0], player.y - BOSS_AT[1]);
      if (d > REARM + 4) bossArmed = true;
      if (bossArmed && d < MEET + 3) {
        bossArmed = false;
        lastTarget = { x: BOSS_AT[0], y: BOSS_AT[1] };
        player.path = [];
        cb.onEncounter({ kind: "boss" });
      }
    }
  };

  const label = (text: string, x: number, y: number, bgc: string, fg: string, size = 6) => {
    g.font = `700 ${size}px "IBM Plex Sans KR", sans-serif`;
    const w = g.measureText(text).width + 6;
    fill(g, x - w / 2 - 0.6, y - size - 3.6, w + 1.2, size + 5.2, C.ink);
    fill(g, x - w / 2, y - size - 3, w, size + 4, bgc);
    g.fillStyle = fg;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(text, x, y - 1.2);
  };

  const hpBar = (x: number, y: number, w: number, remaining: number, hp: number) => {
    fill(g, x - w / 2 - 1, y - 1, w + 2, 4, C.ink);
    fill(g, x - w / 2, y, w, 2, "#3C3E44");
    fill(g, x - w / 2, y, Math.round((w * Math.max(0, remaining)) / Math.max(1, hp)), 2, C.red);
  };

  const render = (now: number) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const viewW = rect.width / scale;
    const viewH = rect.height / scale;
    cam = {
      x: Math.max(0, Math.min(WORLD_W - viewW, player.x - viewW / 2)),
      y: Math.max(Math.min(0, WORLD_H - viewH), Math.min(WORLD_H - viewH, player.y - viewH * 0.55)),
    };
    const k = (canvas.width / rect.width) * scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    fill(g, 0, 0, canvas.width, canvas.height, C.ink);
    g.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    g.drawImage(bg, 0, 0);

    if (tapMark && now - tapMark.t < 500) {
      // 누른 시각이 이 프레임보다 늦을 수 있다(이벤트가 프레임 사이에 옴) → 0 아래로 내려가지 않게
      const t = Math.max(0, (now - tapMark.t) / 500);
      g.strokeStyle = `rgba(240,190,46,${1 - t})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(tapMark.x, tapMark.y, 4 + t * 6, 2 + t * 3, 0, 0, Math.PI * 2);
      g.stroke();
    }

    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    // 잡몹
    for (const m of mobs) {
      const { w, h } = artSize(m.code);
      list.push({
        y: m.y,
        draw: () => {
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.beginPath();
          g.ellipse(m.x, m.y + 1, w / 2, 2, 0, 0, Math.PI * 2);
          g.fill();
          const bob = m.killed ? 0 : Math.round(Math.sin(now / 220 + m.slot) * 1);
          drawMob(g, m.code, Math.round(m.x - w / 2), Math.round(m.y - h + bob + (m.killed ? 3 : 0)), m.killed);
        },
      });
    }
    // 보스
    list.push({
      y: BOSS_AT[1],
      draw: () => {
        g.fillStyle = "rgba(0,0,0,0.4)";
        g.beginPath();
        g.ellipse(BOSS_AT[0], BOSS_AT[1] + 1, 7, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        if (boss.killed) {
          drawChar(g, Math.round(BOSS_AT[0] - 5), Math.round(BOSS_AT[1] - 10), { ...shadowPal, k: "#3C3E44", h: "#2A2C31", s: "#2A2C31", r: "#2A2C31" }, { sit: true });
        } else {
          const bob = Math.round(Math.sin(now / 300) * 1);
          drawChar(g, Math.round(BOSS_AT[0] - 5), Math.round(BOSS_AT[1] - 16 + bob), shadowPal, { frame: 0 });
        }
      },
    });
    // 나
    list.push({
      y: player.y,
      draw: () => {
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.beginPath();
        g.ellipse(player.x, player.y + 1, 5, 2, 0, 0, Math.PI * 2);
        g.fill();
        const moving = player.path.length > 0 || Math.hypot(input().x, input().y) > 0.15;
        const pose = walkPose(player.step * 8, moving && !paused, now);
        drawChar(g, Math.round(player.x - 5), Math.round(player.y - 16), myPal, { frame: pose.frame, back: player.back, hop: pose.hop, squash: pose.squash });
      },
    });
    list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    // 이름표 · 체력
    for (const m of mobs) {
      const { h } = artSize(m.code);
      if (m.killed) {
        label("처치", m.x, m.y - h - 1, "#2A2C31", C.steel, 5.5);
        continue;
      }
      label(m.name, m.x, m.y - h - 4, "#1F2024", C.chalk, 5.5);
      hpBar(m.x, m.y - h - 3, 18, m.remaining, m.hp);
    }
    if (boss.killed) {
      label("DOWN", BOSS_AT[0], BOSS_AT[1] - 14, C.chalk, C.ink, 6.5);
    } else {
      label(boss.rest ? `${boss.name} · 잠듦` : boss.name, BOSS_AT[0], BOSS_AT[1] - 23, C.red, C.chalk, 6.5);
      hpBar(BOSS_AT[0], BOSS_AT[1] - 22, 28, boss.remaining, boss.hp);
    }
    label("나", player.x, player.y - 18, C.yellow, C.ink, 5.5);
    if (atExit) label("출구", EXIT.c * TILE + EXIT.w * 8, EXIT.r * TILE - 2, C.yellow, C.ink, 6);
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      stepPlayer(dt);
      stepMobs(dt);
      checkMeet();
      const c = Math.floor(player.x / TILE);
      const r = Math.floor(player.y / TILE);
      const here = r === EXIT.r && c >= EXIT.c && c < EXIT.c + EXIT.w;
      if (here !== atExit) {
        atExit = here;
        cb.onExitZone(here);
      }
    }
    render(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    setShape(shape) {
      myPal = palOf(myTone, shape);
      shadowPal = shadowOf(shape);
    },
    setMobs(list) {
      const prev = new Map(mobs.map((m) => [m.id, m]));
      mobs = list.map((m) => {
        const old = prev.get(m.id);
        const s = MOB_SLOTS[m.slot] ?? MOB_SLOTS[0];
        return old
          ? { ...old, ...m }
          : { ...m, x: s[0], y: s[1], dir: 1, t: (m.slot * 0.37) % 1, armed: true };
      });
    },
    setBoss(b) {
      boss = b;
    },
    setStick(x, y) {
      stick = { x, y };
    },
    setPaused(p) {
      paused = p;
      if (p) {
        stick = { x: 0, y: 0 };
        keys.clear();
        player.path = [];
      }
    },
    stepBack() {
      if (!lastTarget) return;
      const dx = player.x - lastTarget.x;
      const dy = player.y - lastTarget.y;
      const d = Math.hypot(dx, dy) || 1;
      for (let s = 18; s >= 4; s -= 2) {
        const nx = player.x + (dx / d) * s;
        const ny = player.y + (dy / d) * s + (Math.abs(dy) < 1 ? s : 0);
        if (free(nx, ny)) {
          player.x = nx;
          player.y = ny;
          break;
        }
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    },
    debug() {
      return { x: Math.round(player.x), y: Math.round(player.y), paused, mobs: mobs.map((m) => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y), killed: m.killed })) };
    },
    teleport(x, y) {
      if (free(x, y)) {
        player.x = x;
        player.y = y;
        player.path = [];
      }
    },
  };
}
