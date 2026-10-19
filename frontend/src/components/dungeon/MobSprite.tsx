import { mobArt } from "./mobArt";

const INK = "#0E0E10";

/** 전투 창용 SVG(DungeonStage 의 상대) */
export default function MobSprite({ code, size = 96, className = "" }: { code: string; size?: number; className?: string }) {
  const a = mobArt(code);
  const w = a.rows[0].length;
  const h = a.rows.length;
  const cells: { x: number; y: number; c: string }[] = [];
  a.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== ".") cells.push({ x: i, y: j, c: a.pal[row[i]] ?? INK });
  });
  const px = Math.floor(size / Math.max(w, h));
  return (
    <div className={`relative ${className}`} style={{ width: w * px, height: h * px + 6 }} aria-hidden="true">
      <span className="absolute bottom-0 left-1/2 h-1.5 w-3/4 -translate-x-1/2 rounded-full bg-black/40" />
      <svg viewBox={`0 0 ${w} ${h}`} width={w * px} height={h * px} shapeRendering="crispEdges" className="relative">
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.c} />
        ))}
      </svg>
    </div>
  );
}
