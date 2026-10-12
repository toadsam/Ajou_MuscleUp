import type { LatLng } from "../../lib/running";

// 달린 길 모양(지도 없이 선만). 경로는 이 기기에만 있으므로 다른 기기에서는 안 보인다.
// 위도 · 경도를 평면으로 펴서(경도는 cos(위도)만큼 줄임) 상자에 맞춘다. 시작 초록 점 · 끝 빨간 점.

type Props = { route: LatLng[]; className?: string; label?: string };

export default function RouteSvg({ route, className = "", label = "달린 길" }: Props) {
  if (route.length < 2) return null;
  const lat0 = route[0][0];
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = route.map(([lat, lng]) => [lng * k, -lat] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-6);
  const h = Math.max(Math.max(...ys) - minY, 1e-6);
  const size = 100;
  const pad = 8;
  const scale = (size - pad * 2) / Math.max(w, h);
  const offX = (size - w * scale) / 2;
  const offY = (size - h * scale) / 2;
  const xy = pts.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [sx, sy] = xy[0];
  const [ex, ey] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={`dg-well block aspect-square w-full ${className}`}>
      <path d={d} fill="none" className="stroke-plate-red" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={sx} cy={sy} r="2.6" className="fill-plate-green stroke-steel-950" strokeWidth="1" />
      <circle cx={ex} cy={ey} r="2.6" className="fill-plate-red stroke-steel-950" strokeWidth="1" />
    </svg>
  );
}
