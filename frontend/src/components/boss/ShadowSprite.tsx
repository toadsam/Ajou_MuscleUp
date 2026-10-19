import { useMemo } from "react";
import { CELL, buildPixelAvatar, type PixelAction } from "../avatar/pixelAvatar";
import { resolveSeedFeatures } from "../avatar/seed";

// 그림자 — 내 캐릭터와 같은 픽셀 리프터를 어두운 색으로 그린다(새 픽셀 아트 없음). 눈만 빨간 원판 색.
// 피격 동작은 내 동작의 프레임 1 을 고정해 "맞고 버티는" 모습. 옆모습 동작은 좌우를 뒤집어 나와 마주 보게 한다.

const SHADOW_COLORS = { skin: "#26272B", hair: "#1A1A1C", tank: "#3A3D43", eye: "#D9302A" };

/** 옆모습으로 그리는 동작(정면 그림은 뒤집을 필요가 없다) */
const SIDE_KINDS = new Set(["bench", "pushup", "legpress", "legcurl", "legext", "calf", "seatedrow", "pulldown", "dips", "pushdown", "skull", "crunch", "incline", "lunge", "row", "run"]);

type Props = {
  /** 내 캐릭터 시드 — 머리 모양을 따라가 "나의 그림자"가 된다 */
  avatarSeed: string;
  /** 근육 단계 0~3 (내 캐릭터와 같게) */
  build?: 0 | 1 | 2 | 3;
  female?: boolean;
  action?: PixelAction | null;
  size?: number;
  /** 바닥 그림자를 그릴지 */
  shadow?: boolean;
  className?: string;
};

export default function ShadowSprite({ avatarSeed, build = 1, female = false, action = null, size = 96, shadow = true, className = "" }: Props) {
  const actionKey = action ? JSON.stringify(action) : "";
  const art = useMemo(() => {
    const seed = resolveSeedFeatures(avatarSeed || "shadow");
    const act = actionKey ? (JSON.parse(actionKey) as PixelAction) : null;
    return buildPixelAvatar({
      build,
      fat: 0,
      female,
      hairStyle: seed.hairStyle,
      eyeStyle: 0,
      pose: "stand",
      tierStep: 0,
      plates: 0,
      resting: false,
      risk: "normal",
      colors: { skin: SHADOW_COLORS.skin, hair: SHADOW_COLORS.hair, tank: SHADOW_COLORS.tank },
      eyeColor: SHADOW_COLORS.eye,
      emblem: null,
      skills: { aura: false, wave: false, burst: false },
      action: act,
    });
  }, [avatarSeed, build, female, actionKey]);

  const flip = action ? SIDE_KINDS.has(action.kind) : false;
  const y = (row: number) => row * CELL;

  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 144 192" width={size} height={size} shapeRendering="crispEdges" style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}>
        {shadow && <rect x={4 * CELL} y={y(31)} width={16 * CELL} height={CELL} fill="rgba(0,0,0,0.45)" />}
        {art.runs.map((run) => (
          <rect key={`${run.x}:${run.y}`} x={run.x * CELL} y={y(run.y)} width={run.w * CELL} height={CELL} fill={run.color} />
        ))}
      </svg>
    </div>
  );
}
