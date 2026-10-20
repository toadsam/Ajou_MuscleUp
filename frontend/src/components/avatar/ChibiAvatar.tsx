import { useMemo } from "react";
import { buildChibi, type ChibiSpec } from "./chibiArt";
import { CELL } from "./pixelGrid";
import { resolveSeedFeatures } from "./seed";
import { temperament } from "./mbti";

// 치비 시안 그리기(/dev/avatars 전용 — 실제 화면은 아직 AvatarRenderer). viewBox · 칸 크기는 AvatarRenderer 와 같다(144×192, 한 칸 6).

const tone = (mbti?: string | null) => {
  const v = (mbti ?? "").toUpperCase();
  if (temperament(v) === "NT") return { skin: "#F6D2B8", tank: "#2F6FD0", hair: "#2A3346" };
  if (temperament(v) === "NF") return { skin: "#F7D5C3", tank: "#F0BE2E", hair: "#5A3E36" };
  if (temperament(v) === "SJ") return { skin: "#F1CDB0", tank: "#2E9C55", hair: "#2B2522" };
  if (temperament(v) === "SP") return { skin: "#F5D0B5", tank: "#D9302A", hair: "#3A2A22" };
  return { skin: "#F3CFB2", tank: "#4A4E57", hair: "#2B2F38" };
};

type Props = Omit<ChibiSpec, "colors" | "hairStyle"> & { seed: string; mbti?: string | null; size?: number; tank?: string | null };

export default function ChibiAvatar({ seed, mbti, size = 144, tank, ...spec }: Props) {
  const art = useMemo(() => {
    const features = resolveSeedFeatures(seed || "seed");
    const t = tone(mbti);
    return buildChibi({ ...spec, hairStyle: features.hairStyle, colors: { ...t, tank: tank ?? t.tank } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, mbti, tank, spec.variant, spec.bodyStage, spec.fat, spec.female, spec.expression, spec.pose]);
  return (
    <svg viewBox="0 0 144 192" width={size} height={(size * 192) / 144} shapeRendering="crispEdges" style={{ overflow: "visible" }} role="img" aria-label="치비 아바타 시안">
      <rect x={4 * CELL} y={31 * CELL} width={16 * CELL} height={CELL} fill="rgba(0,0,0,0.35)" />
      {art.runs.map((r) => (
        <rect key={`${r.x}:${r.y}`} x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={CELL} fill={r.color} />
      ))}
      {art.effects.map((fx, i) => (
        <rect key={`fx-${i}`} x={fx.x * CELL} y={fx.y * CELL} width={fx.w * CELL} height={fx.h * CELL} fill={fx.color} className={fx.className || undefined} />
      ))}
    </svg>
  );
}
