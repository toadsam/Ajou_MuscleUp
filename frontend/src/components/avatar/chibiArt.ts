// 치비(머리 큰 귀여운) 픽셀 아바타 — 카드 · 홈 · 친구 · 모임의 서 있는 그림과 정면 운동 동작 9가지(2026-10-20). /dev/avatars 에서 모두 본다.
//
// 같은 24×32 칸 · 같은 Grid(좌우 대칭 · 자동 외곽선)를 쓰고, 머리 대 몸 비율만 크게 바꿨다.
//   A 2등신(머리 14 : 몸 13) · B 2.5등신(12 : 15) · C 3등신(10 : 17). 지금 리프터는 4등신쯤(머리 8 : 몸 24).
// 머리: 둥근 이마 · 아래가 통통한 볼(만두형), 머리카락은 얼굴보다 한 칸 넓게 부풀고 앞머리 끝이 들쭉날쭉.
// 눈: 2칸 폭 × 3~4칸 높이, 왼쪽 위 하이라이트 + 아래 반사광. 볼터치. 표정 5가지(기본 · 웃음 · 힘줌 · 지침 · 반짝).
// 몸 단계 bodyStage 0~5 — 단계마다 실루엣이 확실히 다르게:
//   0 새싹 가는 팔 · 좁은 어깨 / 1 입문 팔 두께 2 / 2 근력 둥근 어깨 · 작은 알통 / 3 벌크 V자 · 가슴선 · 승모 · 키 +1
//   4 괴력 굵은 팔 · 큰 알통 · 가슴 가르는 선 / 5 전설 최대 + 어깨 윤기 · 반짝
// 셀 셰이딩: 피부 · 민소매 · 반바지 아래쪽 · 안쪽에 한 단계 어두운 색, 머리카락 · 어깨에 하이라이트.
import { BAR, Grid, INK, IRON, shade } from "./pixelGrid";
import { drawBar, type ActionKind, type Equip, type PixelAction, type PixelAvatarArt, type PixelEffect } from "./pixelAvatar";

export type ChibiVariant = "A" | "B" | "C";
export type ChibiExpression = "normal" | "smile" | "strain" | "tired" | "sparkle" | "wink";
export type ChibiPose = "stand" | "flex";

export type ChibiSpec = {
  variant: ChibiVariant;
  /** 몸 단계 0~5 */
  bodyStage: 0 | 1 | 2 | 3 | 4 | 5;
  fat: 0 | 1;
  female: boolean;
  hairStyle: number;
  expression: ChibiExpression;
  pose: ChibiPose;
  colors: { skin: string; hair: string; tank: string };
  /** 티어 0(BRONZE) ~ 7(CHALLENGER) — 장비가 하나씩: 1 손목 보호대 · 2 벨트 · 3 무릎 보호대 · 4 머리띠 · 5 금 버클 · 6 금 벨트 · 7 금 신발 */
  tierStep?: number;
  /** 휴식 중: 어깨에 수건 · 감은 눈 */
  resting?: boolean;
  /** 진화 갈래 마크 색(가슴 2×2) */
  emblem?: string | null;
  /** 운동 직후 펌핑: 땀 · 김(근육 +1 단계는 그리는 쪽이 bodyStage 에 더한다) */
  pumped?: boolean;
  skills?: { aura: boolean; wave: boolean; burst: boolean };
  /** 정면 운동 동작(CHIBI_FRONT_KINDS). 있으면 pose 대신 이 동작으로 팔 · 다리 · 기구를 그린다 */
  action?: PixelAction | null;
  /** 눈 색(그림자 보스: 빨강). 없으면 잉크 */
  eyeColor?: string;
  /** 볼터치(그림자는 끈다). 기본 켜짐 */
  blush?: boolean;
};

/** 몸 단계 이름(0~5) — 화면 글자 */
export const BODY_STAGE_NAMES = ["새싹", "입문", "근력", "벌크", "괴력", "전설"];

/** 티어 → 장비 단계 0(BRONZE) ~ 7(CHALLENGER) */
const TIER_STEP: Record<string, number> = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3, DIAMOND: 4, MASTER: 5, GRANDMASTER: 6, CHALLENGER: 7 };
export const tierStepOf = (tier?: string | null) => TIER_STEP[(tier ?? "").toUpperCase()] ?? 0;
/** 머리띠 색: 민소매가 빨강이면 파랑, 아니면 빨강 */
export const headbandFor = (tank: string) => (tank.toUpperCase() === "#D9302A" ? "#2F6FD0" : "#D9302A");

/** 치비 정면 그림으로 그리는 운동 동작(나머지는 옆모습 — pixelPoses · buildSideArt) */
export const CHIBI_FRONT_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["squat", "deadlift", "press", "curl", "raise", "fly", "pullup", "legraise", "flex"]);

/**
 * 동작별 팔 모양 [프레임 0, 프레임 1]. 치비는 머리가 어깨보다 넓어서, 머리 위 · 목 뒤로 가는 팔은 팔꿈치를 머리 바깥으로 뺀다.
 *  stand 차렷 · flex 알통 · rack 바를 목 뒤에 메고 손은 머리 옆 · rackLow 바를 쇄골 앞에 · overhead 머리 위로 다 편 팔
 *  curl 팔뚝을 접어 주먹이 어깨 앞 · wide 옆으로 편 팔 · front 가슴 앞에서 모은 손 · hang 철봉에 매달림
 */
type ArmMode = "stand" | "flex" | "rack" | "rackLow" | "overhead" | "curl" | "wide" | "front" | "hang";
function armModeOf(kind: ActionKind, f: 0 | 1, equip: Equip): ArmMode {
  const table: Partial<Record<ActionKind, [ArmMode, ArmMode]>> = {
    squat: equip === "barbell" ? ["rack", "rack"] : ["stand", "stand"],
    deadlift: ["stand", "stand"],
    press: ["rackLow", "overhead"],
    curl: ["stand", "curl"],
    raise: ["stand", "wide"],
    fly: ["wide", "front"],
    pullup: ["hang", "hang"],
    legraise: ["hang", "hang"],
    flex: ["stand", "flex"],
  };
  return table[kind]?.[f] ?? "stand";
}
/** 철봉 높이(행) — 턱걸이로 올라가면 머리가 봉 앞을 지난다 */
const HANG_BAR = 1;
type Box = { x0: number; x1: number; y0: number; y1: number };

const VARIANT: Record<ChibiVariant, { head: number; headHW: number; eyeH: number; legs: number; torso: number }> = {
  A: { head: 14, headHW: 8, eyeH: 4, legs: 2, torso: 6 },
  B: { head: 12, headHW: 7, eyeH: 3, legs: 3, torso: 7 },
  C: { head: 10, headHW: 6, eyeH: 3, legs: 4, torso: 8 },
};

/**
 * 단계별 치수 — 단계마다 한눈에 달라 보이게(사용자: "바뀔 때마다 다이나믹하게"). 0 새싹 → 5 전설
 * 어깨 반폭 3 → 10(4 이상부터 머리보다 넓다) · 팔 두께 1 → 5 · 다리 1 → 5 · 키(몸통 줄) -1 → +2
 * 승모(머리 옆으로 솟는 줄) · 허벅지 · 종아리 · 목(새싹만 보인다) · 알통 봉우리(알통 자세)
 * 민소매: 0~1 헐렁(아래가 퍼짐) · 2~3 몸에 붙음(V) · 4~5 끈 나시(스트링어, 옆구리 · 어깨 근육이 드러남)
 */
const STAGE = {
  shoulderHW: [3, 5, 6, 8, 9, 10],
  waistHW: [3, 3, 4, 4, 5, 5],
  armT: [1, 2, 2, 3, 4, 5],
  bicep: [0, 0, 1, 2, 3, 3],
  legW: [1, 2, 3, 3, 4, 5],
  quad: [0, 0, 0, 1, 1, 2],
  height: [-1, 0, 0, 1, 2, 2],
  trap: [0, 0, 0, 1, 2, 3],
  neck: [1, 0, 0, 0, 0, 0],
  peak: [0, 1, 2, 3, 4, 5],
};
type TankStyle = "loose" | "fitted" | "stringer";
const tankStyleOf = (s: number): TankStyle => (s <= 1 ? "loose" : s <= 3 ? "fitted" : "stringer");

const PINK = "#F4A3A3";
const WHITE = "#FFFFFF";
const SWEAT = "#9EC1E8";
const STAR = "#F0BE2E";
const SHORTS = "#2B3A67";
const SHOE = "#EEECE6";
const MOUTH = "#C8484F";
const IRIS = "#4A4F5C";

export function buildChibi(spec: ChibiSpec): PixelAvatarArt {
  const g = new Grid();
  const v = VARIANT[spec.variant];
  const s = spec.bodyStage;
  const skin = spec.colors.skin;
  const skinShade = shade(skin, 0.15);
  const skinLight = shade(skin, -0.25);
  const hair = spec.colors.hair;
  const hairLight = shade(hair, -0.6);
  const hairShade = shade(hair, 0.25);
  const tank = spec.colors.tank;
  const tankShade = shade(tank, 0.24);
  const tankLight = shade(tank, -0.18);
  const shortsShade = shade(SHORTS, 0.35);

  // ---- 세로 배치(아래에서 위로) ----
  const bottom = 30;
  const torsoRows = v.torso + STAGE.height[s];
  const shoeTop = bottom - 1;
  const legTop = shoeTop - v.legs;
  const shortsTop = legTop - 3;
  const torsoTop = shortsTop - torsoRows;
  const neckRows = STAGE.neck[s];
  const headBottom = torsoTop - neckRows; // 새싹은 가는 목이 보이고, 그 위로는 머리가 어깨에 바로 얹힌다
  const headTop = headBottom - v.head + 1;

  const shoulderHW = STAGE.shoulderHW[s];
  const waistHW = STAGE.waistHW[s] + spec.fat;
  const armT = STAGE.armT[s];
  const legW = STAGE.legW[s];
  const quad = STAGE.quad[s];
  const xs = 12 - shoulderHW; // 왼쪽 어깨 끝 열
  const tankStyle = tankStyleOf(s);
  const delt = s >= 2 ? armT + 1 : armT; // 어깨(삼각근) 폭
  const tier = spec.tierStep ?? 0;
  let wrist: { x0: number; x1: number; y: number } | null = null; // 손목(보호대 자리)

  // ---- 운동 동작 ----
  const act = spec.action ?? null;
  const kind = act?.kind ?? null;
  const f = act?.frame ?? 0;
  const equip = act?.equip ?? "none";
  // 프레임 1: 스쿼트 · 데드는 몸을 내리고(행 +), 턱걸이는 올린다(행 -)
  const drop = f === 1 ? (kind === "squat" ? 3 : kind === "deadlift" ? 2 : kind === "pullup" ? -5 : 0) : 0;
  const bentLegs = f === 1 && (kind === "squat" || kind === "deadlift");
  const raisedLegs = f === 1 && kind === "legraise";
  const armMode: ArmMode = kind ? armModeOf(kind, f, equip) : spec.pose === "flex" ? "flex" : "stand";
  const hl = 12 - v.headHW - 1; // 머리카락까지 머리 왼쪽 끝 열
  const fw = Math.max(2, armT); // 주먹 폭
  const shoeColor = tier >= 7 ? "#F0BE2E" : SHOE;
  // 동작 팔의 주먹 · 팔꿈치(절대 좌표 — 몸이 내려가도 바에 붙은 손은 그대로)
  const geo = ((): { fist: Box; elbow: { x: number; y: number } | null } | null => {
    if (armMode === "rack") {
      const by = torsoTop - 1 + drop;
      const x1 = Math.min(xs - 1, hl - 2);
      return { fist: { x0: x1 - fw + 1, x1, y0: by - 1, y1: by }, elbow: { x: x1 - fw + 1, y: by + 4 } };
    }
    if (armMode === "overhead" || armMode === "hang") {
      const by = armMode === "hang" ? HANG_BAR : -1;
      const x1 = hl - 1;
      const x0 = x1 - fw + 1;
      const ey = armMode === "hang" ? headBottom - 3 + drop : headTop + 5;
      return { fist: { x0, x1, y0: by - 1, y1: by }, elbow: { x: x0 - 1, y: ey } };
    }
    if (armMode === "rackLow") {
      const by = torsoTop + 2 + drop;
      const x1 = xs - 1;
      return { fist: { x0: x1 - fw + 1, x1, y0: by - 1, y1: by }, elbow: { x: x1 - fw, y: torsoTop + 6 + drop } };
    }
    if (armMode === "wide") {
      const xEnd = Math.max(-7, xs - 8);
      const y = torsoTop + 1 + drop;
      return { fist: { x0: xEnd - fw, x1: xEnd - 1, y0: y, y1: y + 1 }, elbow: null };
    }
    if (armMode === "front") {
      const y = torsoTop + 3 + drop;
      return { fist: { x0: 10, x1: 11, y0: y - 1, y1: y }, elbow: null };
    }
    return null;
  })();
  let fist: Box | null = geo?.fist ?? null;
  // 몸 뒤 기구(머리 · 몸보다 먼저): 철봉 · 목 뒤 · 머리 위 바벨
  if (kind === "pullup" || kind === "legraise") g.rect(-6, 29, HANG_BAR, HANG_BAR, BAR);
  if (equip === "barbell" && geo && (armMode === "rack" || armMode === "overhead")) drawBar(g, geo.fist.y1, geo.fist.x0 - 2, act?.plates ?? []);

  // ---- 다리 · 신발 ----
  const legX0 = 11 - legW;
  if (bentLegs) {
    // 정면에서 본 앉은 자세: 무릎이 반바지 옆으로 벌어지고 발은 넓게
    const kx0 = Math.min(legX0 - 2, 12 - (waistHW + 1) - 2);
    const kx1 = kx0 + legW;
    g.mirrorRect(kx0, kx1, legTop + drop - 2, shoeTop - 1, skin);
    g.mirrorRect(kx0, kx0, legTop + drop - 2, shoeTop - 1, skinShade);
    g.mirrorRect(kx0 - 1, kx1, shoeTop, bottom, shoeColor);
    g.mirrorRect(kx0 - 1, kx1, bottom, bottom, "#B9B7B0");
  } else if (raisedLegs) {
    // 다리 들기: 다리가 앞으로 올라와 바닥이 비고, 신발 바닥은 몸 앞(아래 "몸 앞 기구")에 그린다
  } else {
    g.oy = kind === "pullup" ? drop : 0; // 턱걸이로 올라가면 다리도 같이
    g.mirrorRect(legX0, 10, legTop, shoeTop - 1, skin);
    if (legW >= 2) g.mirrorRect(legX0, legX0, legTop, shoeTop - 1, skinShade);
    if (quad >= 1 && v.legs >= 3) g.mirrorRect(legX0 - 1, legX0 - 1, legTop + 1, legTop + 1, skin); // 종아리
    g.mirrorRect(legX0 - 1, 10, shoeTop, bottom, SHOE);
    g.mirrorRect(legX0 - 1, 10, bottom, bottom, "#B9B7B0");
    g.mirrorSet(legX0 - 1, shoeTop, null); // 신발 앞코 둥글게
    if (s === 0) g.mirrorRect(legX0 - 2, legX0 - 1, shoeTop, bottom, SHOE); // 큰 신발에 가는 다리(새싹)
  }
  g.oy = drop; // 여기부터 몸통 · 머리는 몸과 같이 움직인다

  // ---- 반바지: 허벅지가 굵으면 아래가 퍼진다 ----
  const shortsHW = waistHW + 1;
  g.band(shortsHW, shortsTop, legTop - 1, SHORTS);
  if (quad > 0) {
    g.band(shortsHW + quad, legTop - 2, legTop - 1, SHORTS);
    g.mirrorRect(12 - shortsHW - quad, 12 - shortsHW - quad, legTop - 2, legTop - 1, shortsShade);
  }
  g.mirrorRect(12 - shortsHW, 12 - shortsHW, shortsTop, legTop - 1, shortsShade);
  if (bentLegs) g.band(shortsHW + 1, legTop - 2, legTop - 1, SHORTS); // 앉으면 허벅지가 앞으로 와 넓어 보인다
  g.rect(11, 12, legTop - 1, legTop - 1, null); // 가랑이
  g.band(shortsHW, shortsTop, shortsTop, "#3A4C82"); // 허리 밴드

  // ---- 몸통 ----
  const topHW = shoulderHW - (s >= 2 ? 2 : 1); // 몸통 위쪽 반폭(어깨는 살)
  const taperHW = (r: number) => {
    const t = torsoRows <= 1 ? 1 : r / (torsoRows - 1);
    return Math.max(waistHW, Math.round(topHW - (topHW - waistHW) * Math.min(1, t * 1.4)));
  };
  if (tankStyle === "loose") {
    // 헐렁한 민소매: 거의 직사각형, 아래 단이 한 칸 퍼진다
    const hwL = Math.max(waistHW, shoulderHW - 1);
    g.band(hwL, torsoTop, torsoTop + torsoRows - 2, tank);
    g.band(hwL + 1, torsoTop + torsoRows - 1, torsoTop + torsoRows - 1, tankShade);
    g.mirrorRect(12 - hwL, 12 - hwL, torsoTop + 3, torsoTop + torsoRows - 2, tankShade); // 늘어진 주름
  } else if (tankStyle === "fitted") {
    for (let r = 0; r < torsoRows; r += 1) g.band(taperHW(r), torsoTop + r, torsoTop + r, tank);
    g.band(waistHW, torsoTop + torsoRows - 1, torsoTop + torsoRows - 1, tankShade);
    g.mirrorRect(12 - waistHW, 12 - waistHW, torsoTop + 2, torsoTop + torsoRows - 1, tankShade);
    g.band(Math.max(2, topHW - 1), torsoTop + 3, torsoTop + 3, tankShade); // 가슴 아래 음영
    if (s >= 3) g.mirrorRect(12 - topHW + 1, 12 - topHW + 2, torsoTop + 1, torsoTop + 1, tankLight); // 가슴 윤기
  } else {
    // 끈 나시: 몸통은 살(V자 · 옆구리 근육), 앞판은 가슴 가운데만 덮고 끈 두 줄이 어깨로
    for (let r = 0; r < torsoRows; r += 1) g.band(taperHW(r), torsoTop + r, torsoTop + r, skin);
    g.mirrorRect(12 - topHW + 1, 12 - topHW + 2, torsoTop + 1, torsoTop + 1, skinLight); // 가슴 윤기
    if (spec.female) {
      // 크롭탑: 가슴만 덮고, 아래는 복근(가운데 선 + 가로 마디)
      for (let r = 0; r <= 3; r += 1) g.band(taperHW(r) - 1, torsoTop + r, torsoTop + r, tank);
      g.band(taperHW(3) - 1, torsoTop + 3, torsoTop + 3, tankShade);
      g.rect(11, 12, torsoTop + 5, torsoTop + torsoRows - 1, skinShade);
      for (let r = torsoTop + 5; r < torsoTop + torsoRows - 1; r += 2) g.rect(9, 14, r, r, skinShade);
      g.rect(11, 12, torsoTop + 5, torsoTop + torsoRows - 1, skinShade);
    } else {
      // 끈 나시: 앞판이 몸통을 거의 덮고 옆구리(광배) 한 칸 · 어깨 · 가슴 윗부분만 살
      for (let r = 2; r < torsoRows; r += 1) g.band(Math.max(2, taperHW(r) - 1), torsoTop + r, torsoTop + r, tank);
      g.band(Math.max(2, taperHW(torsoRows - 1) - 1), torsoTop + torsoRows - 1, torsoTop + torsoRows - 1, tankShade);
      g.rect(11, 12, torsoTop + 2, torsoTop + 4, tankShade); // 가슴 가르는 선
      g.mirrorRect(9, 9, torsoTop, torsoTop + 1, tank); // 끈
    }
  }
  if (spec.fat) g.band(waistHW + 1, torsoTop + torsoRows - 3, torsoTop + torsoRows - 2, tankStyle === "stringer" ? skin : tank); // 배
  if (tankStyle !== "stringer") {
    // 민소매 목선(V)
    g.rect(10, 13, torsoTop, torsoTop, skin);
    g.rect(11, 12, torsoTop + 1, torsoTop + 1, skin);
  }

  // ---- 목(새싹) · 승모(벌크 이상: 어깨에서 머리 쪽으로 솟는 비탈) ----
  if (neckRows > 0) g.rect(10, 13, torsoTop - neckRows, torsoTop - 1, skinShade);
  const trap = STAGE.trap[s];
  for (let k = 1; k <= trap; k += 1) {
    const from = xs + 1 + k * 2;
    if (from <= 11) {
      g.mirrorRect(from, 11, torsoTop - k, torsoTop - k, skin);
      g.mirrorSet(from, torsoTop - k, skinShade);
    }
  }

  // ---- 팔 ----
  if (armMode === "flex") {
    drawFlexArms();
  } else if (armMode !== "stand") {
    drawActionArms();
  } else {
    // 서기: 어깨 공 → 위팔(알통) → 팔뚝 → 주먹
    const ax1 = xs + delt - 1; // 팔 안쪽 끝(몸통에 붙음)
    const inner = ax1 - (s >= 2 ? 1 : 0);
    const ax0 = ax1 - armT + 1 - (s >= 2 ? 1 : 0);
    const armBottom = torsoTop + torsoRows; // 주먹이 허리 아래
    // 어깨 공
    g.mirrorRect(xs, ax1, torsoTop, torsoTop + 1, skin);
    if (s >= 2) g.mirrorSet(xs, torsoTop, null); // 둥근 모서리
    if (s >= 3) g.mirrorRect(xs + 1, xs + 2, torsoTop, torsoTop, skinLight); // 어깨 윤기
    // 위팔 · 팔뚝 — 큰 단계(4+)는 알통 아래부터 바깥으로 한 칸 벌린다(광배가 넓어 팔이 뜬다)
    const flare = s >= 4 ? 1 : 0;
    const split = torsoTop + 3 + STAGE.bicep[s];
    g.mirrorRect(ax0, inner, torsoTop + 2, split - 1, skin);
    g.mirrorRect(ax0 - flare, inner - flare, split, armBottom - 1, skin);
    if (armT >= 2) g.mirrorRect(inner - flare, inner - flare, split, armBottom - 1, skinShade); // 안쪽 음영
    const bic = STAGE.bicep[s];
    if (bic > 0) {
      g.mirrorRect(ax0 - bic, ax0 - 1, torsoTop + 2, torsoTop + 2 + bic, skin); // 알통(바깥으로)
      g.mirrorSet(ax0 - bic, torsoTop + 2, null);
      g.mirrorSet(ax0 - bic, torsoTop + 2 + bic, null);
      if (bic >= 2) g.mirrorSet(ax0 - bic + 1, torsoTop + 3, skinLight);
    }
    // 주먹
    g.mirrorRect(ax0 - flare, inner - flare, armBottom, armBottom + 1, skin);
    g.mirrorRect(ax0 - flare, inner - flare, armBottom + 1, armBottom + 1, skinShade);
    wrist = { x0: ax0 - flare, x1: inner - flare, y: armBottom - 1 };
    fist = { x0: ax0 - flare, x1: inner - flare, y0: armBottom + drop, y1: armBottom + 1 + drop };
  }

  /** 굵기 t 의 팔 한 토막(왼쪽을 그리고 거울) — 절대 좌표 */
  function limb(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let i = 0; i <= n; i += 1) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / n);
      const y = Math.round(a.y + ((b.y - a.y) * i) / n);
      g.mirrorRect(x, x + t - 1, y, y + t - 1, skin);
    }
  }

  function drawActionArms() {
    g.oy = 0;
    const d = drop;
    // 어깨 공(몸과 같이 움직인다)
    g.mirrorRect(xs, xs + delt - 1, torsoTop + d, torsoTop + 1 + d, skin);
    if (s >= 3) g.mirrorRect(xs + 1, xs + 2, torsoTop + d, torsoTop + d, skinLight);
    const S = { x: xs, y: torsoTop + 1 + d };
    const bic = STAGE.bicep[s];
    if (armMode === "curl") {
      // 팔뚝을 접어 주먹이 어깨 앞 — 위팔이 짧아지고 알통이 한 칸 더 솟는다
      const ax1 = xs + delt - 1 - (s >= 2 ? 1 : 0);
      const ax0 = ax1 - armT + 1;
      g.mirrorRect(ax0, ax1, torsoTop + 2 + d, torsoTop + torsoRows - 2 + d, skin);
      g.mirrorRect(ax1, ax1, torsoTop + 3 + d, torsoTop + torsoRows - 2 + d, skinShade);
      const b = bic + 1;
      g.mirrorRect(ax0 - b, ax0 - 1, torsoTop + 3 + d, torsoTop + 3 + b + d, skin); // 알통
      g.mirrorSet(ax0 - b, torsoTop + 3 + d, null);
      g.mirrorSet(ax0 - b, torsoTop + 3 + b + d, null);
      fist = { x0: ax0, x1: ax0 + fw - 1, y0: torsoTop + d, y1: torsoTop + 1 + d };
      if (tier >= 1) g.mirrorRect(fist.x0, fist.x1, fist.y1 + 1, fist.y1 + 1, "#EEECE6");
    } else if (armMode === "wide" && fist) {
      const th = Math.min(armT, 3);
      g.mirrorRect(fist.x1 + 1, xs + 1, fist.y0, fist.y0 + th - 1, skin);
      if (th >= 2) g.mirrorRect(fist.x1 + 1, xs, fist.y0 + th - 1, fist.y0 + th - 1, skinShade);
      if (bic > 0) g.mirrorRect(xs - 3, xs - 2, fist.y0 - 1, fist.y0 - 1, skin); // 어깨 쪽 알통 윗선
      if (tier >= 1) g.mirrorRect(fist.x1 + 1, fist.x1 + 1, fist.y0, fist.y1, "#EEECE6");
    } else if (armMode === "front" && fist) {
      limb(S, { x: fist.x0 - armT + 1, y: fist.y0 }, armT);
      if (tier >= 1) g.mirrorRect(fist.x0 - 1, fist.x0 - 1, fist.y0, fist.y1, "#EEECE6");
    } else if (geo?.elbow && fist) {
      // 위팔(어깨 → 팔꿈치) · 팔뚝(팔꿈치 → 주먹)
      limb(S, geo.elbow, armT);
      limb(geo.elbow, { x: fist.x0, y: fist.y1 + 1 }, Math.min(armT, fw));
      if (tier >= 1) g.mirrorRect(fist.x0, fist.x1, fist.y1 + 1, fist.y1 + 1, "#EEECE6");
    }
    if (fist && armMode !== "curl") {
      g.mirrorRect(fist.x0, fist.x1, fist.y0, fist.y1, skin);
      g.mirrorRect(fist.x0, fist.x1, fist.y1, fist.y1, skinShade);
    }
    g.oy = d;
  }

  function drawFlexArms() {
    // 더블 바이셉스: 위팔은 어깨에서 옆으로 길게, 팔뚝은 짧게 위로, 주먹은 볼 높이에서 멈춘다(머리와 떨어지게)
    const hx0 = 12 - v.headHW;
    const elbowX = Math.min(xs - 4, hx0 - armT - 4);
    const uy0 = torsoTop; // 위팔 윗줄
    const uy1 = torsoTop + armT - 1;
    g.mirrorRect(xs, xs + delt - 1, torsoTop, torsoTop + 1, skin); // 어깨
    g.mirrorRect(elbowX, xs, uy0, uy1, skin); // 위팔
    if (armT >= 2) g.mirrorRect(elbowX + 1, xs, uy1, uy1, skinShade);
    // 팔뚝: 팔꿈치에서 위로(볼 높이까지)
    const fy0 = uy0 - 3 - Math.floor(s / 2);
    g.mirrorRect(elbowX, elbowX + armT - 1, fy0, uy1, skin);
    if (armT >= 2) g.mirrorRect(elbowX, elbowX, fy0 + 1, uy1, skinShade);
    wrist = { x0: elbowX, x1: elbowX + armT - 1, y: fy0 };
    // 주먹(팔뚝보다 한 칸 넓게)
    g.mirrorRect(elbowX - 1, elbowX + armT, fy0 - 2, fy0 - 1, skin);
    g.mirrorRect(elbowX - 1, elbowX + armT, fy0 - 1, fy0 - 1, skinShade);
    g.mirrorSet(elbowX - 1, fy0 - 2, null);
    fist = { x0: elbowX - 1, x1: elbowX + armT, y0: fy0 - 2 + drop, y1: fy0 - 1 + drop };
    // 알통: 위팔 위로 솟는 둥근 봉우리 — 단계마다 한 칸씩 크고 높게
    const peak = STAGE.peak[s];
    if (peak > 0) {
      const bx0 = elbowX + armT + 1;
      const bx1 = Math.min(xs - 1, bx0 + peak + 1);
      g.mirrorRect(bx0, bx1, uy0 - peak, uy0 - 1, skin);
      g.mirrorSet(bx0, uy0 - peak, null);
      g.mirrorSet(bx1, uy0 - peak, null);
      g.mirrorRect(bx0 + 1, Math.min(bx1 - 1, bx0 + 2), uy0 - peak, uy0 - peak, skinLight); // 윤기
    }
  }

  // ---- 티어 장비 · 휴식 수건 · 진화 마크(몸) ----
  const WRAPS = "#EEECE6";
  if (tier >= 1 && wrist) {
    const w = wrist as { x0: number; x1: number; y: number };
    g.mirrorRect(w.x0, w.x1, w.y, w.y, WRAPS);
  }
  if (tier >= 2) {
    const beltY = torsoTop + torsoRows - 1;
    g.band(waistHW, beltY, beltY, tier >= 6 ? "#F0BE2E" : "#6B4A2E");
    g.rect(11, 12, beltY, beltY, tier >= 5 ? (tier >= 6 ? "#B5850E" : "#F0BE2E") : "#B8BBC0");
  }
  if (tier >= 3 && !bentLegs && !raisedLegs) g.mirrorRect(legX0, 10, legTop + (v.legs >= 3 ? 1 : 0), legTop + (v.legs >= 3 ? 1 : 0), "#3A3D43"); // 무릎 보호대
  if (tier >= 7 && !bentLegs && !raisedLegs) {
    g.oy = kind === "pullup" ? drop : 0;
    g.mirrorRect(legX0 - 1, 10, shoeTop, bottom - 1, "#F0BE2E"); // 금 신발
    if (s === 0) g.mirrorRect(legX0 - 2, legX0 - 1, shoeTop, bottom - 1, "#F0BE2E");
    g.oy = drop;
  }
  if (spec.resting && !act) g.rect(xs, xs + Math.max(2, delt), torsoTop, torsoTop + 4, WRAPS); // 왼쪽 어깨에 수건
  if (spec.emblem) {
    const mark = spec.emblem.toUpperCase() === tank.toUpperCase() ? WRAPS : spec.emblem;
    g.rect(11, 12, torsoTop + 2, torsoTop + 3, mark);
  }

  // ---- 머리(만두형: 둥근 이마 · 통통한 볼) ----
  const hw = v.headHW;
  const hx0 = 12 - hw;
  const hx1 = 11 + hw;
  for (let r = headTop; r <= headBottom; r += 1) {
    const fromTop = r - headTop;
    const fromBottom = headBottom - r;
    const inset = fromTop === 0 ? 3 : fromTop === 1 ? 1 : fromBottom === 0 ? 3 : fromBottom === 1 ? 1 : 0;
    g.rect(hx0 + inset, hx1 - inset, r, r, skin);
  }
  // 귀
  const eyeRow = headBottom - (v.eyeH + 3);
  g.mirrorRect(hx0 - 1, hx0 - 1, eyeRow + 1, eyeRow + 2, skin);
  g.mirrorSet(hx0 - 1, eyeRow + 2, skinShade);
  // 턱 그림자(목)
  g.rect(hx0 + 4, hx1 - 4, headBottom, headBottom, skinShade);

  // ---- 머리카락: 얼굴보다 한 칸 넓게, 위로 한 칸 더 ----
  const hairRows = Math.max(3, Math.round(v.head * 0.3)); // 이마를 덮는 줄 수
  const fringe = headTop + hairRows; // 앞머리 끝 줄
  const style = spec.hairStyle % 4;
  for (let r = headTop - 1; r < fringe; r += 1) {
    const fromTop = r - (headTop - 1);
    const inset = fromTop === 0 ? 3 : fromTop === 1 ? 1 : 0;
    g.rect(hx0 - 1 + inset, hx1 + 1 - inset, r, r, hair);
  }
  g.rect(hx0 + 3, hx1 - 5, headTop, headTop, hairLight); // 윤기 띠
  g.rect(hx0 + 2, hx0 + 3, headTop + 1, headTop + 1, hairLight);
  // 옆머리(귀 위까지)
  g.mirrorRect(hx0 - 1, hx0, fringe, eyeRow, hair);
  g.mirrorRect(hx0, hx0, fringe, eyeRow, hairShade);
  // 앞머리 끝: 스타일마다 들쭉날쭉
  const tips: Record<number, number[]> = {
    0: [1, 2, 4, 6, 8, 9, 11, 13],
    1: [0, 1, 3, 4, 7, 10, 12, 13],
    2: [2, 3, 4, 5, 9, 10, 11],
    3: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };
  (tips[style] ?? tips[0]).forEach((dx) => {
    const x = hx0 + 1 + dx;
    if (x <= hx1 - 1) g.set(x, fringe, hair);
  });
  if (style === 1 && !spec.female) {
    // 삐죽 머리: 위로 솟는 가닥
    [hx0 + 2, hx0 + 6, hx1 - 5, hx1 - 2].forEach((x) => g.rect(x, x, headTop - 3, headTop - 2, hair));
  }
  if (style === 2 && !spec.female) {
    // 높은 앞머리(퐁파두르)
    g.rect(hx0 + 2, hx1 - 2, headTop - 2, headTop - 2, hair);
    g.rect(hx0 + 4, hx1 - 4, headTop - 3, headTop - 3, hair);
    g.rect(hx0 + 5, hx0 + 7, headTop - 2, headTop - 2, hairLight);
  }
  if (spec.female) {
    if (style % 2 === 1) {
      // 똥머리
      g.rect(10, 13, headTop - 5, headTop - 2, hair);
      g.rect(9, 14, headTop - 4, headTop - 3, hair);
      g.rect(10, 11, headTop - 5, headTop - 5, hairLight);
    } else {
      // 긴 머리: 어깨 아래로
      g.mirrorRect(hx0 - 1, hx0, eyeRow + 1, headBottom + 3, hair);
      g.mirrorRect(hx0, hx0, eyeRow + 1, headBottom + 3, hairShade);
    }
  }

  if (tier >= 4) {
    const band = headbandFor(tank);
    g.rect(hx0 - 1, hx1 + 1, fringe - 1, fringe - 1, band);
  }

  // ---- 얼굴 ----
  const ex = spec.expression;
  const eyeW = 2;
  const exL = hx0 + Math.max(2, Math.round(hw * 0.35)); // 왼쪽 눈 왼쪽 열
  const exR = 23 - exL - (eyeW - 1); // 거울
  const last = eyeRow + v.eyeH - 1;
  const eyeInk = spec.eyeColor ?? INK;
  const eye = (x: number) => {
    const left = x < 12;
    if (ex === "wink" && !left) {
      // 윙크: 오른쪽 눈만 ^ 로 감는다
      const row = eyeRow + Math.floor(v.eyeH / 2);
      g.set(x - 1, row, eyeInk);
      g.set(x, row - 1, eyeInk);
      g.set(x + 1, row, eyeInk);
      return;
    }
    if (ex === "strain") {
      // > < 꾹 감은 눈
      const mid = eyeRow + Math.floor(v.eyeH / 2);
      g.set(left ? x : x + 1, mid - 1, eyeInk);
      g.set(left ? x + 1 : x, mid, eyeInk);
      g.set(left ? x : x + 1, mid + 1, eyeInk);
      return;
    }
    if (spec.resting) {
      g.rect(x, x + eyeW - 1, last, last, eyeInk); // 감은 눈(쉬는 중)
      return;
    }
    if (ex === "tired") {
      g.rect(x, x + eyeW - 1, last, last, eyeInk); // 반쯤 감긴 눈
      g.rect(x, x + eyeW - 1, last - 1, last - 1, skinShade);
      return;
    }
    if (ex === "smile") {
      // ^ ^ 웃는 눈(세 칸)
      const x0 = left ? x : x - 1;
      const row = eyeRow + Math.floor(v.eyeH / 2);
      g.set(x0, row, eyeInk);
      g.set(x0 + 1, row - 1, eyeInk);
      g.set(x0 + 2, row, eyeInk);
      return;
    }
    g.rect(x, x + eyeW - 1, eyeRow, last, eyeInk);
    g.set(x + 1, last, IRIS); // 아래 반사광
    g.set(x, eyeRow, ex === "sparkle" ? STAR : WHITE); // 하이라이트(빛은 왼쪽 위)
    if (v.eyeH >= 4) g.set(x, eyeRow + 1, ex === "sparkle" ? WHITE : WHITE);
    if (ex === "sparkle") g.set(x + 1, eyeRow + 1, WHITE);
  };
  eye(exL);
  eye(exR);
  // 눈썹(힘줌만)
  if (ex === "strain") {
    g.set(exL, eyeRow - 1, hairShade);
    g.set(exL + 1, eyeRow, hairShade);
    g.set(exR + 1, eyeRow - 1, hairShade);
    g.set(exR, eyeRow, hairShade);
  }
  // 볼터치(눈 아래 바깥쪽)
  if (ex !== "tired" && spec.blush !== false) {
    g.rect(exL - 1, exL, last + 1, last + 1, PINK);
    g.rect(exR + 1, exR + 2, last + 1, last + 1, PINK);
  }
  // 입(턱 두 줄 위)
  const my = headBottom - 2;
  if (ex === "smile" || ex === "sparkle" || ex === "wink") {
    g.set(10, my - 1, INK);
    g.rect(11, 12, my, my, MOUTH);
    g.set(13, my - 1, INK);
    g.rect(11, 12, my - 1, my - 1, INK);
  } else if (ex === "strain") {
    g.rect(10, 13, my - 1, my - 1, INK);
    g.rect(10, 13, my, my, WHITE); // 이 악물기
  } else if (ex === "tired") {
    g.set(10, my, INK);
    g.set(11, my - 1, INK);
    g.set(12, my, INK);
    g.set(13, my - 1, INK);
  } else {
    g.rect(11, 12, my - 1, my - 1, INK);
  }

  // ---- 몸 앞 기구: 바벨(데드 · 프레스 시작 · 컬) · 덤벨 — 주먹이 봉을 쥐게 다시 칠한다 ----
  g.oy = 0;
  if (raisedLegs) {
    // 앞으로 든 다리: 반바지 앞에 정강이 끝과 신발 바닥이 보인다
    g.mirrorRect(legX0, 10, legTop - 3, legTop - 2, skin);
    g.mirrorRect(legX0 - 1, 10, legTop - 1, legTop + 1, shoeColor);
    g.mirrorRect(legX0, 9, legTop, legTop, "#B9B7B0");
  }
  if (act && fist) {
    const fx = fist;
    const front = armMode === "stand" || armMode === "rackLow" || armMode === "curl" || armMode === "front";
    if (equip === "barbell" && (armMode === "stand" || armMode === "rackLow" || armMode === "curl")) drawBar(g, fx.y1, fx.x0 - 2, act.plates);
    if (front) {
      g.mirrorRect(fx.x0, fx.x1, fx.y0, fx.y1, skin);
      g.mirrorRect(fx.x0, fx.x1, fx.y1, fx.y1, skinShade);
    }
    if (equip === "dumbbell" && armMode !== "hang") {
      // 덤벨(손잡이를 세로로 쥔 모양): 주먹 위아래로 쇳덩이
      g.mirrorRect(fx.x0 - 1, fx.x1 + 1, fx.y0 - 2, fx.y0 - 1, IRON);
      g.mirrorRect(fx.x0 - 1, fx.x1 + 1, fx.y1 + 1, fx.y1 + 2, IRON);
      g.mirrorRect(fx.x0, fx.x1, fx.y0 - 2, fx.y0 - 2, shade(IRON, -0.3));
    }
  }

  g.outline();

  // ---- 효과(외곽선 없음) ----
  const effects: PixelEffect[] = [];
  if ((ex === "tired" || ex === "strain" || spec.pumped) && !spec.resting) {
    effects.push({ x: hx1 + 2, y: headTop + 3, w: 1, h: 2, color: SWEAT, className: "", delay: 0 });
    effects.push({ x: hx1 + 3, y: headTop + 5, w: 1, h: 1, color: SWEAT, className: "", delay: 0 });
  }
  if (ex === "sparkle" || s >= 4) {
    effects.push({ x: hx0 - 3, y: headTop, w: 1, h: 1, color: STAR, className: "pxa-spark", delay: 0 });
    effects.push({ x: hx1 + 3, y: headTop + 2, w: 1, h: 1, color: STAR, className: "pxa-spark", delay: 300 });
  }
  if (s === 5) {
    // 전설: 어깨 위로 김이 오르고 반짝임이 하나 더
    effects.push({ x: hx0 - 2, y: headTop + 4, w: 1, h: 1, color: WHITE, className: "pxa-spark", delay: 600 });
    effects.push({ x: xs, y: headBottom - 1, w: 1, h: 1, color: "#E8E6E0", className: "pxa-dust", delay: 0 });
    effects.push({ x: 23 - xs, y: headBottom - 2, w: 1, h: 1, color: "#E8E6E0", className: "pxa-dust", delay: 350 });
  }

  if (spec.pumped && !spec.resting) {
    effects.push({ x: xs + 1, y: headBottom - 2, w: 1, h: 1, color: "#E8E6E0", className: "pxa-dust", delay: 200 });
    effects.push({ x: 22 - xs, y: headBottom - 1, w: 1, h: 1, color: "#E8E6E0", className: "pxa-dust", delay: 550 });
  }
  if (spec.resting) effects.push({ x: hx1 + 2, y: headTop - 1, w: 2, h: 1, color: "#9EC1E8", className: "pxa-zz", delay: 0 });
  const sk = spec.skills;
  if (sk?.aura) {
    [[hx0 - 3, headTop + 6], [hx1 + 3, headTop + 7], [xs - 2, torsoTop + 3], [23 - xs + 2, torsoTop + 4]].forEach(([x, y], i) =>
      effects.push({ x, y, w: 1, h: 1, color: STAR, className: "pxa-spark", delay: i * 250 }),
    );
  }
  if (sk?.wave) {
    effects.push({ x: 5, y: bottom, w: 2, h: 1, color: "#E8E6E0", className: "pxa-wave", delay: 0 });
    effects.push({ x: 17, y: bottom, w: 2, h: 1, color: "#E8E6E0", className: "pxa-wave", delay: 400 });
  }
  if (sk?.burst) {
    effects.push({ x: xs - 1, y: torsoTop - 1, w: 1, h: 1, color: "#D9302A", className: "pxa-spark", delay: 120 });
    effects.push({ x: 24 - xs, y: torsoTop - 1, w: 1, h: 1, color: "#D9302A", className: "pxa-spark", delay: 480 });
  }

  return {
    runs: g.runs(),
    effects,
    regions: {
      face: { x: hx0, y: headTop + drop, w: hw * 2, h: v.head },
      body: { x: xs, y: torsoTop + drop, w: shoulderHW * 2, h: torsoRows },
      emblem: { x: 11, y: torsoTop + 2 + drop, w: 2, h: 2 },
    },
  };
}

/**
 * 몸 단계(0~5) 제안: 근육 데이터가 없어도 운동으로 몸이 커지게, 셋 중 가장 높은 단계를 쓴다.
 *  - 근육량(인바디, muscularityNormalized 0~1) → 0~5
 *  - 캐릭터 레벨(1~100, 3대 · 체성분 · 출석) → 레벨 10 · 25 · 40 · 60 · 80 에서 한 단계씩
 *  - 활동 레벨(출석 · 주간 목표 · 할 일 점수, 상한 없음) → Lv 3 · 6 · 10 · 15 · 22 에서 한 단계씩
 */
export function bodyStageOf(p: { muscularity: number; level: number; activityLevel: number }): ChibiSpec["bodyStage"] {
  const fromMuscle = Math.floor(Math.max(0, Math.min(1, p.muscularity)) * 5.99);
  const fromLevel = [10, 25, 40, 60, 80].filter((t) => p.level >= t).length;
  const fromActivity = [3, 6, 10, 15, 22].filter((t) => p.activityLevel >= t).length;
  return Math.max(fromMuscle, fromLevel, fromActivity) as ChibiSpec["bodyStage"];
}
