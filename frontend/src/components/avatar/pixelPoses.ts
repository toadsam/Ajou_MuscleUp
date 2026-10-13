// 기구 · 옆모습 운동 동작 — 관절 좌표(머리 · 어깨 · 엉덩이 · 무릎 · 발 · 팔꿈치 · 손)를 두 프레임씩 적어 두고
// 굵은 선으로 이어 그린다. 손으로 칸을 찍는 정면 아바타(pixelAvatar)와 같은 그리드 · 색 · 외곽선 규칙을 쓴다.
//
// 좌표는 칸 단위(0..23 열, 바닥은 30행). 기본은 오른쪽을 본다.
// 다리 · 팔은 [먼 쪽, 가까운 쪽] 순서 — 먼 쪽은 어둡게, 가까운 쪽은 몸 앞에 그린다.
// 동작을 고치면 /dev/avatars 의 "운동 동작" 줄과 종목 그림으로 확인한다.
import { BAR, COLLAR, Grid, INK, IRON, MAX_PIXEL_PLATES, disc, plateColors, shade, type Palette } from "./pixelGrid";
import type { Equip, PixelAction, PixelAvatarArt, PixelAvatarSpec } from "./pixelAvatar";

export const POSE_KINDS = [
  "legpress",
  "legcurl",
  "legext",
  "calf",
  "lunge",
  "row",
  "seatedrow",
  "pulldown",
  "dips",
  "crunch",
  "incline",
  "skull",
  "pushdown",
] as const;
export type PoseKind = (typeof POSE_KINDS)[number];

export const isPoseKind = (kind: string): kind is PoseKind => (POSE_KINDS as readonly string[]).includes(kind);

type P = [number, number];
type Dir = [number, number];
/** 기구: 사각형(양 끝 포함) 또는 선 */
type Prop = { r: [number, number, number, number]; c: string } | { line: [P, P]; c: string; t?: number };

type Frame = {
  head: P;
  /** 정수리 방향 · 얼굴이 보는 방향(가로세로 한 칸 단위) */
  crown: Dir;
  look: Dir;
  shoulder: P;
  hip: P;
  legs: { knee: P; foot: P; toes?: Dir }[];
  arms: { elbow: P; hand: P }[];
  /** 몸 뒤에 그리는 기구 */
  back?: Prop[];
  /** 몸 앞에 그리는 기구 */
  front?: Prop[];
  /** 케이블이 나오는 곳(손까지 줄을 긋는다) */
  cable?: P;
};

const MACHINE = "#4A4E57";
const PAD = "#6B4A2E";
const CABLE = "#B8BBC0";
const MAT = "#3A3D43";

type PoseDef = (equip: Equip) => [Frame, Frame];

const UP: Dir = [0, -1];
const DOWN: Dir = [0, 1];
const LEFT: Dir = [-1, 0];
const RIGHT: Dir = [1, 0];

const POSES: Record<PoseKind, PoseDef> = {
  // 레그 프레스: 비스듬히 누워 발판을 민다(머리가 왼쪽 위)
  legpress: () => {
    const back: Prop[] = [
      { line: [[3, 12], [8, 22]], c: PAD, t: 3 },
      { r: [6, 12, 24, 25], c: PAD },
      { r: [2, 22, 29, 30], c: MACHINE },
      { line: [[11, 27], [23, 15]], c: CABLE, t: 1 },
    ];
    const base = { head: [4, 10] as P, crown: UP, look: RIGHT, shoulder: [6, 14] as P, hip: [10, 22] as P, back };
    return [
      {
        ...base,
        legs: [{ knee: [14, 15], foot: [17, 20], toes: UP }],
        arms: [{ elbow: [9, 19], hand: [11, 22] }],
        front: [{ r: [19, 20, 15, 22], c: MACHINE }],
      },
      {
        ...base,
        legs: [{ knee: [15, 18], foot: [21, 15], toes: UP }],
        arms: [{ elbow: [9, 19], hand: [11, 22] }],
        front: [{ r: [23, 24, 10, 17], c: MACHINE }],
      },
    ];
  },
  // 레그 컬: 엎드려 발뒤꿈치를 엉덩이 쪽으로(머리가 오른쪽)
  legcurl: () => {
    const back: Prop[] = [
      { r: [2, 19, 23, 24], c: PAD },
      { r: [5, 6, 25, 30], c: MACHINE },
      { r: [15, 16, 25, 30], c: MACHINE },
    ];
    const base = { head: [21, 19] as P, crown: RIGHT, look: DOWN, shoulder: [17, 21] as P, hip: [10, 21] as P, back };
    const arms = [{ elbow: [18, 24] as P, hand: [19, 26] as P }];
    return [
      { ...base, arms, legs: [{ knee: [5, 21], foot: [0, 21], toes: DOWN }], front: [{ r: [-1, 1, 18, 19], c: PAD }] },
      { ...base, arms, legs: [{ knee: [5, 21], foot: [7, 15], toes: UP }], front: [{ r: [8, 9, 14, 16], c: PAD }] },
    ];
  },
  // 레그 익스텐션: 앉아서 무릎을 편다
  legext: () => {
    const back: Prop[] = [
      { r: [4, 5, 12, 22], c: PAD },
      { r: [5, 14, 23, 24], c: PAD },
      { r: [8, 9, 25, 30], c: MACHINE },
      { r: [4, 15, 29, 30], c: MACHINE },
    ];
    const base = { head: [8, 8] as P, crown: UP, look: RIGHT, shoulder: [8, 13] as P, hip: [9, 22] as P, back };
    const arms = [{ elbow: [10, 18] as P, hand: [11, 22] as P }];
    return [
      { ...base, arms, legs: [{ knee: [15, 22], foot: [15, 28], toes: RIGHT }], front: [{ r: [16, 17, 25, 27], c: PAD }] },
      { ...base, arms, legs: [{ knee: [15, 22], foot: [21, 20], toes: UP }], front: [{ r: [20, 22, 22, 23], c: PAD }] },
    ];
  },
  // 카프 레이즈: 발판 끝에 서서 발뒤꿈치를 든다
  calf: (equip) => {
    const back: Prop[] = [{ r: [9, 18, 29, 30], c: MACHINE }];
    const stand = (dy: number): Frame => ({
      head: [12, 5 - dy],
      crown: UP,
      look: RIGHT,
      shoulder: [12, 10 - dy],
      hip: [12, 19 - dy],
      legs: [{ knee: [12, 24 - dy], foot: [12, 27 - dy], toes: RIGHT }],
      arms: [{ elbow: [12, 14 - dy], hand: [equip === "dumbbell" ? 12 : 13, 18 - dy] }],
      back,
      front: dy ? [{ r: [14, 15, 26, 28], c: "#E8E6E0" }] : [],
    });
    return [stand(0), stand(2)];
  },
  // 런지: 다리를 앞뒤로 벌리고 내려간다
  lunge: () => [
    {
      head: [12, 5],
      crown: UP,
      look: RIGHT,
      shoulder: [12, 10],
      hip: [12, 19],
      legs: [
        { knee: [9, 24], foot: [7, 28], toes: RIGHT },
        { knee: [15, 24], foot: [16, 28], toes: RIGHT },
      ],
      arms: [{ elbow: [12, 14], hand: [12, 19] }],
    },
    {
      head: [12, 9],
      crown: UP,
      look: RIGHT,
      shoulder: [12, 14],
      hip: [12, 22],
      legs: [
        { knee: [9, 28], foot: [5, 28], toes: RIGHT },
        { knee: [17, 23], foot: [17, 28], toes: RIGHT },
      ],
      arms: [{ elbow: [12, 18], hand: [12, 22] }],
    },
  ],
  // 벤트오버 로우: 허리를 숙이고 배꼽 쪽으로 당긴다(덤벨이면 벤치에 손을 짚는다)
  row: (equip) => {
    const db = equip === "dumbbell";
    const back: Prop[] = db
      ? [
          { r: [17, 23, 21, 22], c: PAD },
          { r: [21, 22, 23, 30], c: MACHINE },
        ]
      : [];
    const base = {
      head: [19, 11] as P,
      crown: RIGHT,
      look: DOWN,
      shoulder: [16, 13] as P,
      hip: [9, 18] as P,
      legs: [{ knee: [11, 23] as P, foot: [10, 28] as P, toes: RIGHT }],
      back,
    };
    const far = db ? [{ elbow: [19, 17] as P, hand: [20, 20] as P }] : [];
    return [
      { ...base, arms: [...far, { elbow: [16, 18], hand: [16, 22] }] },
      { ...base, arms: [...far, { elbow: [12, 12], hand: [14, 17] }] },
    ];
  },
  // 시티드 로우: 앉아서 케이블을 몸 쪽으로 당긴다
  seatedrow: () => {
    const back: Prop[] = [
      { r: [21, 22, 6, 30], c: MACHINE },
      { r: [18, 19, 22, 28], c: MACHINE },
      { r: [2, 10, 25, 26], c: PAD },
      { r: [5, 6, 27, 30], c: MACHINE },
    ];
    const legs = [{ knee: [12, 20] as P, foot: [17, 25] as P, toes: UP }];
    return [
      { head: [10, 11], crown: UP, look: RIGHT, shoulder: [9, 15], hip: [7, 23], legs, arms: [{ elbow: [12, 17], hand: [16, 18] }], back, cable: [21, 18] },
      { head: [6, 10], crown: UP, look: RIGHT, shoulder: [6, 14], hip: [7, 23], legs, arms: [{ elbow: [2, 17], hand: [8, 19] }], back, cable: [21, 18] },
    ];
  },
  // 랫풀다운: 앉아서 머리 위 바를 가슴 쪽으로 끌어내린다
  pulldown: () => {
    const back: Prop[] = [
      { r: [18, 19, -4, 30], c: MACHINE },
      { r: [9, 19, -5, -4], c: MACHINE },
      { r: [5, 12, 24, 25], c: PAD },
      { r: [8, 9, 26, 30], c: MACHINE },
      { r: [12, 15, 19, 20], c: PAD },
    ];
    const legs = [{ knee: [14, 22] as P, foot: [14, 28] as P, toes: RIGHT }];
    return [
      { head: [9, 10], crown: UP, look: RIGHT, shoulder: [9, 14], hip: [9, 23], legs, arms: [{ elbow: [10, 7], hand: [11, 1] }], back, cable: [11, -3] },
      { head: [8, 10], crown: UP, look: RIGHT, shoulder: [8, 14], hip: [9, 23], legs, arms: [{ elbow: [5, 18], hand: [11, 13] }], back, cable: [11, -3] },
    ];
  },
  // 딥스: 평행봉에서 몸을 내렸다 올린다
  dips: () => {
    const back: Prop[] = [
      { r: [6, 18, 18, 18], c: BAR },
      { r: [7, 7, 19, 30], c: MACHINE },
      { r: [17, 17, 19, 30], c: MACHINE },
    ];
    return [
      { head: [12, 6], crown: UP, look: RIGHT, shoulder: [12, 10], hip: [12, 18], legs: [{ knee: [12, 23], foot: [8, 24], toes: LEFT }], arms: [{ elbow: [12, 14], hand: [12, 18] }], back },
      { head: [13, 10], crown: UP, look: RIGHT, shoulder: [13, 14], hip: [12, 22], legs: [{ knee: [12, 27], foot: [8, 28], toes: LEFT }], arms: [{ elbow: [8, 15], hand: [12, 18] }], back },
    ];
  },
  // 크런치: 누워서 무릎을 세우고 어깨를 든다(머리가 왼쪽)
  crunch: () => {
    const back: Prop[] = [{ r: [-2, 22, 30, 30], c: MAT }];
    const legs = [{ knee: [15, 23] as P, foot: [18, 28] as P, toes: RIGHT }];
    return [
      { head: [0, 26], crown: LEFT, look: UP, shoulder: [4, 27], hip: [11, 27], legs, arms: [{ elbow: [3, 23], hand: [0, 24] }], back },
      { head: [3, 20], crown: LEFT, look: UP, shoulder: [6, 23], hip: [11, 27], legs, arms: [{ elbow: [6, 19], hand: [3, 18] }], back },
    ];
  },
  // 인클라인 벤치: 기울어진 벤치에 누워 위로 민다(머리가 왼쪽 위)
  incline: () => {
    const back: Prop[] = [
      { line: [[4, 13], [11, 23]], c: PAD, t: 3 },
      { r: [11, 17, 24, 25], c: PAD },
      { r: [13, 14, 26, 30], c: MACHINE },
      { line: [[8, 19], [5, 30]], c: MACHINE, t: 2 },
    ];
    const base = {
      head: [5, 10] as P,
      crown: UP,
      look: RIGHT,
      shoulder: [8, 14] as P,
      hip: [13, 22] as P,
      legs: [{ knee: [18, 22] as P, foot: [19, 28] as P, toes: RIGHT }],
      back,
    };
    return [
      { ...base, arms: [{ elbow: [7, 18], hand: [11, 13] }] },
      { ...base, arms: [{ elbow: [9, 9], hand: [10, 4] }] },
    ];
  },
  // 라잉 트라이셉스 익스텐션: 누워서 팔꿈치는 두고 바를 이마 쪽으로
  skull: () => {
    const back: Prop[] = [
      { r: [1, 17, 21, 22], c: "#3A3D43" },
      { r: [3, 4, 23, 30], c: "#8E9197" },
      { r: [14, 15, 23, 30], c: "#8E9197" },
    ];
    const base = {
      head: [3, 18] as P,
      crown: LEFT,
      look: UP,
      shoulder: [7, 19] as P,
      hip: [14, 19] as P,
      legs: [{ knee: [18, 21] as P, foot: [19, 28] as P, toes: RIGHT }],
      back,
    };
    return [
      { ...base, arms: [{ elbow: [8, 12], hand: [4, 14] }] },
      { ...base, arms: [{ elbow: [8, 12], hand: [8, 6] }] },
    ];
  },
  // 트라이셉스 푸시다운: 케이블 손잡이를 허벅지 쪽으로 밀어 내린다
  pushdown: () => {
    const back: Prop[] = [
      { r: [19, 20, -2, 30], c: MACHINE },
      { r: [15, 20, -3, -2], c: MACHINE },
    ];
    const base = {
      head: [11, 5] as P,
      crown: UP,
      look: RIGHT,
      shoulder: [11, 10] as P,
      hip: [11, 19] as P,
      legs: [{ knee: [11, 24] as P, foot: [11, 28] as P, toes: RIGHT }],
      back,
      cable: [16, -1] as P,
    };
    return [
      { ...base, arms: [{ elbow: [12, 15], hand: [15, 12] }] },
      { ...base, arms: [{ elbow: [12, 15], hand: [14, 20] }] },
    ];
  },
};

/** 네모 붓으로 a → b 를 잇는다 */
function line(g: Grid, a: P, b: P, t: number, color: string) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const lo = Math.floor((t - 1) / 2);
  const hi = t - 1 - lo;
  for (let i = 0; i <= n; i += 1) {
    const x = Math.round(a[0] + (dx * i) / n);
    const y = Math.round(a[1] + (dy * i) / n);
    g.rect(x - lo, x + hi, y - lo, y + hi, color);
  }
}

const mid = (a: P, b: P, k: number): P => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k)];

function drawProp(g: Grid, p: Prop) {
  if ("r" in p) g.rect(p.r[0], p.r[1], p.r[2], p.r[3], p.c);
  else line(g, p.line[0], p.line[1], p.t ?? 1, p.c);
}

export function buildPoseArt(spec: PixelAvatarSpec, act: PixelAction, pal: Palette): PixelAvatarArt {
  const kind = act.kind as PoseKind;
  const fr = POSES[kind](act.equip)[act.frame];
  const g = new Grid();
  const b = spec.build;
  const torsoT = 4 + (b >= 2 ? 1 : 0);
  const thighT = 3 + (b >= 2 ? 1 : 0);
  const armT = 2 + (b >= 2 ? 1 : 0);
  const farSkin = shade(pal.skin, 0.18);

  const drawLeg = (leg: Frame["legs"][number], near: boolean) => {
    const skin = near ? pal.skin : farSkin;
    const shoe = near ? pal.shoe : shade(pal.shoe, 0.2);
    line(g, fr.hip, leg.knee, thighT, skin);
    line(g, fr.hip, mid(fr.hip, leg.knee, 0.45), thighT, near ? pal.shorts : shade(pal.shorts, 0.2)); // 반바지
    line(g, leg.knee, leg.foot, 2, skin);
    // 신발 2×2 + 발끝 쪽으로 한 칸
    const [fx, fy] = leg.foot;
    const toes = leg.toes ?? RIGHT;
    g.rect(fx - 1, fx, fy, fy + 1, shoe);
    if (toes[0] > 0) g.set(fx + 1, fy + 1, shoe);
    else if (toes[0] < 0) g.set(fx - 2, fy + 1, shoe);
    else if (toes[1] < 0) g.rect(fx - 1, fx, fy - 1, fy - 1, shoe);
    else g.rect(fx - 1, fx, fy + 2, fy + 2, shoe);
  };
  const drawArm = (arm: Frame["arms"][number], near: boolean) => {
    const skin = near ? pal.skin : farSkin;
    line(g, fr.shoulder, arm.elbow, armT, skin);
    line(g, arm.elbow, arm.hand, 2, skin);
    g.rect(arm.hand[0] - 1, arm.hand[0], arm.hand[1] - 1, arm.hand[1], near ? pal.handColor : farSkin);
  };

  (fr.back ?? []).forEach((p) => drawProp(g, p));
  const legs = fr.legs;
  const arms = fr.arms;
  if (legs.length > 1) drawLeg(legs[0], false);
  if (arms.length > 1) drawArm(arms[0], false);

  // 몸통 · 목
  line(g, fr.shoulder, fr.hip, torsoT, pal.tank);
  line(g, mid(fr.shoulder, fr.hip, 0.85), fr.hip, torsoT, pal.shorts);
  if (spec.tierStep >= 2) {
    const belt = mid(fr.shoulder, fr.hip, 0.75);
    line(g, belt, belt, torsoT, spec.tierStep >= 6 ? "#F0BE2E" : "#6B4A2E");
  }
  line(g, fr.head, fr.shoulder, 2, pal.skin);

  // 머리(5×5, 모서리를 깎는다): 정수리 쪽 · 뒤통수 쪽은 머리카락
  const [cx, cy] = fr.head;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
      const hair = dx * fr.crown[0] + dy * fr.crown[1] === 2 || dx * fr.look[0] + dy * fr.look[1] === -2;
      g.set(cx + dx, cy + dy, hair ? pal.hair : pal.skin);
    }
  }
  if (spec.tierStep >= 4) {
    // 머리띠: 정수리 바로 아래 줄
    for (let k = -2; k <= 2; k += 1) {
      const x = cx + fr.crown[0] * 1 + (fr.crown[0] ? 0 : k);
      const y = cy + fr.crown[1] * 1 + (fr.crown[1] ? 0 : k);
      if (g.get(x, y) === pal.skin) g.set(x, y, pal.headband);
    }
  }
  g.set(cx + fr.look[0] * 3, cy + fr.look[1] * 3, pal.skin); // 코
  g.set(cx + fr.look[0] + fr.crown[0], cy + fr.look[1] + fr.crown[1], spec.resting ? pal.skin : INK); // 눈

  // 손에 든 것 — 옆에서 보면 가까운 원판이 몸을 다 가려서, 조금 작게 몸통 앞 · 가까운 팔다리 뒤에 그린다
  const hand = arms[arms.length - 1].hand;
  if (act.equip === "barbell") {
    const list = act.plates.slice(0, MAX_PIXEL_PLATES);
    const colors = plateColors(list);
    list.forEach((p, i) => {
      const size = p.size === 0 ? 6 : 4;
      disc(g, hand[0] - size / 2 + i, hand[1] - size / 2, size, colors[i]);
    });
    g.rect(hand[0] - 1 + list.length, hand[0] + list.length, hand[1] - 1, hand[1], COLLAR);
  } else if (act.equip === "dumbbell") {
    disc(g, hand[0] - 2, hand[1] - 2, 4, IRON);
  } else if (fr.cable) {
    g.rect(hand[0] - 1, hand[0] + 1, hand[1], hand[1], CABLE); // 손잡이
  }
  drawLeg(legs[legs.length - 1], true);
  if (fr.cable) line(g, fr.cable, hand, 1, CABLE);
  drawArm(arms[arms.length - 1], true);

  (fr.front ?? []).forEach((p) => drawProp(g, p));

  g.outline();
  return {
    runs: g.runs(),
    effects: [],
    regions: {
      face: { x: cx - 2, y: cy - 2, w: 5, h: 5 },
      body: { x: Math.min(fr.shoulder[0], fr.hip[0]), y: Math.min(fr.shoulder[1], fr.hip[1]), w: 4, h: 4 },
      emblem: { x: fr.shoulder[0], y: fr.shoulder[1], w: 2, h: 2 },
    },
  };
}
