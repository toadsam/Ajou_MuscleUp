import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LiftPoint } from "../../lib/lifts";

// 종목 하나의 날짜별 최고 추정 1RM. 색은 짐 플로어 원판 빨강 + 철판 회색(InbodyConsult 그래프와 같은 값)
const CHART = { line: "#D9302A", ink: "#0E0E10", axis: "#55585F", grid: "#3A3D43", tick: "#A6A8AD", panel: "#1A1A1C" };
const tick = { fill: CHART.tick, fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 13, fontWeight: 700 };

export default function LiftHistoryChart({ points }: { points: LiftPoint[] }) {
  const data = points.map((p) => ({ ...p, day: p.date.slice(5).replace("-", "/") }));
  const values = points.map((p) => p.e1rm);
  const min = Math.floor((Math.min(...values) - 5) / 5) * 5;
  const max = Math.ceil((Math.max(...values) + 5) / 5) * 5;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="day" stroke={CHART.axis} tick={tick} tickLine={false} minTickGap={16} />
        <YAxis stroke={CHART.axis} tick={tick} tickLine={false} domain={[Math.max(0, min), max]} width={48} />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 2 }}
          contentStyle={{ background: CHART.panel, border: `3px solid ${CHART.ink}`, borderRadius: 4 }}
          labelStyle={{ color: "#EEECE6", fontWeight: 700 }}
          itemStyle={{ color: "#EEECE6" }}
          formatter={(value) => [`${value}kg`, "추정 1RM"]}
        />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke={CHART.line}
          strokeWidth={4}
          dot={{ r: 5, fill: CHART.line, stroke: CHART.ink, strokeWidth: 2 }}
          activeDot={{ r: 7, fill: CHART.line, stroke: CHART.ink, strokeWidth: 2 }}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
