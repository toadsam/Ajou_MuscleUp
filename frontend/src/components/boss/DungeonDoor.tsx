// 던전 문: 어두운 문틀 + 빨간 눈 두 점(새 픽셀 그림 없이 사각형만). 충전 연출 · 홈 지도 입구 목록 · 홈 한 줄에서 같이 쓴다.

export default function DungeonDoor({ size = 64, eyes = true, className = "" }: { size?: number; eyes?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 32 40" width={size} height={size * 1.25} shapeRendering="crispEdges" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="38" fill="#0E0E10" />
      <rect x="4" y="4" width="24" height="36" fill="#1A1A1C" />
      <rect x="7" y="7" width="18" height="33" fill="#060607" />
      {/* 문틀 볼트 */}
      <rect x="4" y="4" width="2" height="2" fill="#9A9DA3" />
      <rect x="26" y="4" width="2" height="2" fill="#9A9DA3" />
      <rect x="4" y="36" width="2" height="2" fill="#9A9DA3" />
      <rect x="26" y="36" width="2" height="2" fill="#9A9DA3" />
      {eyes && (
        <>
          <rect className="dg-door-eye" x="11" y="18" width="3" height="3" fill="#D9302A" />
          <rect className="dg-door-eye" x="18" y="18" width="3" height="3" fill="#D9302A" />
        </>
      )}
    </svg>
  );
}
