import { useEffect, useState } from "react";
import { CELL, buildPixelAvatar, type PixelAvatarArt } from "../avatar/pixelAvatar";
import type { LiftExerciseInfo } from "../../lib/lifts";
import { barbellLoad, motionFor } from "../../lib/liftMotion";

// 종목 그림 — 운동 세션 캐릭터와 같은 픽셀 동작을 "누구나 같은 모습"(기본 리프터)으로 그린다.
// 그림 크기는 그려진 칸에 딱 맞춰 자른다(바벨 원판이 넓게 나가도 잘리지 않게).
// animate 면 두 장면을 번갈아 보여 준다. 움직임 줄이기 설정이면 힘주는 장면 하나만.

const DEMO_KG = 60; // 바벨 종목 그림에 끼울 원판(한쪽 파랑 20kg)
const cache = new Map<string, { art: PixelAvatarArt; box: [number, number, number, number] }>();

function iconArt(info: LiftExerciseInfo, frame: 0 | 1) {
  const key = `${info.code}:${info.category}:${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const motion = motionFor(info);
  const art = buildPixelAvatar({
    build: 1,
    fat: 0,
    female: false,
    hairStyle: 0,
    eyeStyle: 0,
    pose: "stand",
    tierStep: 0,
    plates: 0,
    resting: false,
    risk: "normal",
    colors: { skin: "#f1c4a5", hair: "#1f2937", tank: "#D9302A" },
    emblem: null,
    skills: { aura: false, wave: false, burst: false },
    action: {
      kind: motion.kind,
      frame,
      equip: motion.equip,
      plates: motion.equip === "barbell" ? barbellLoad(DEMO_KG).pixel : [],
    },
  });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  art.runs.forEach((r) => {
    x0 = Math.min(x0, r.x);
    x1 = Math.max(x1, r.x + r.w);
    y0 = Math.min(y0, r.y);
    y1 = Math.max(y1, r.y + 1);
  });
  const entry = { art, box: [x0, y0, x1, y1] as [number, number, number, number] };
  cache.set(key, entry);
  return entry;
}

const reducedMotion = () => {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

type Props = {
  info: LiftExerciseInfo;
  /** 그림 칸 크기(px, 정사각형) */
  size?: number;
  animate?: boolean;
  className?: string;
};

export default function ExerciseIcon({ info, size = 40, animate = false, className = "" }: Props) {
  const [frame, setFrame] = useState<0 | 1>(1);

  useEffect(() => {
    if (!animate || reducedMotion()) {
      setFrame(1);
      return;
    }
    const t = window.setInterval(() => setFrame((f) => (f === 1 ? 0 : 1)), 750);
    return () => window.clearInterval(t);
  }, [animate]);

  // 두 장면의 칸을 합쳐 자른다(움직여도 그림이 튀지 않게)
  const a = iconArt(info, 0);
  const b = iconArt(info, 1);
  const { art } = frame === 1 ? b : a;
  const x0 = Math.min(a.box[0], b.box[0]);
  const y0 = Math.min(a.box[1], b.box[1]);
  const w = Math.max(a.box[2], b.box[2]) - x0;
  const h = Math.max(a.box[3], b.box[3]) - y0;
  const side = Math.max(w, h);
  const vx = x0 - (side - w) / 2;
  const vy = y0 - (side - h) / 2;

  return (
    <svg
      viewBox={`${vx * CELL} ${vy * CELL} ${side * CELL} ${side * CELL}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`flex-none ${className}`.trim()}
    >
      {art.runs.map((run) => (
        <rect key={`${run.x}:${run.y}`} x={run.x * CELL} y={run.y * CELL} width={run.w * CELL} height={CELL} fill={run.color} />
      ))}
    </svg>
  );
}
