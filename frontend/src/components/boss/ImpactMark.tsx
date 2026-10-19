// 타격 자국: 픽셀 별 모양(초크 흰색 + 잉크 테두리). 바닥 균열 · 벽 먼지도 여기(새 픽셀 그림 없이 사각형만).

const RAYS = [
  [18, 0, 4, 10],
  [18, 30, 4, 10],
  [0, 18, 10, 4],
  [30, 18, 10, 4],
  [6, 6, 6, 6],
  [28, 6, 6, 6],
  [6, 28, 6, 6],
  [28, 28, 6, 6],
];

export default function ImpactMark({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      {RAYS.map(([x, y, w, h], i) => (
        <rect key={i} x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill="#0E0E10" />
      ))}
      {RAYS.map(([x, y, w, h], i) => (
        <rect key={`w${i}`} x={x} y={y} width={w} height={h} fill="#F4F2EC" />
      ))}
      <rect x={16} y={16} width={8} height={8} fill="#0E0E10" />
      <rect x={17} y={17} width={6} height={6} fill="#F0BE2E" />
    </svg>
  );
}

/** 지진: 바닥 균열 — 착지점에서 갈라지는 픽셀 선 */
export function FloorCrack() {
  const segs = [
    [40, 6, 10, 3],
    [50, 3, 12, 3],
    [62, 5, 10, 3],
    [30, 8, 10, 3],
    [20, 11, 10, 3],
    [72, 8, 8, 3],
    [80, 11, 10, 3],
    [10, 13, 10, 3],
    [90, 13, 8, 3],
    [46, 9, 4, 3],
    [58, 8, 4, 3],
  ];
  return (
    <svg viewBox="0 0 100 18" width="200" height="36" shapeRendering="crispEdges" aria-hidden="true">
      {segs.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="#0E0E10" />
      ))}
      {segs.map(([x, y, w], i) => (
        <rect key={`c${i}`} x={x + 1} y={y + 1} width={w - 2} height={1} fill="#9A9DA3" />
      ))}
    </svg>
  );
}
