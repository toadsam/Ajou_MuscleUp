import type { GrowthParams } from "./types";
import type { SeededFeatures } from "./seed";

type Props = {
  growthParams: GrowthParams;
  seedFeatures: SeededFeatures;
  strokeColor: string;
  bodyColor: string;
};

export default function Legs({ growthParams, seedFeatures, strokeColor, bodyColor }: Props) {
  const quadWidth = 10 + seedFeatures.baseBuild + growthParams.quadGrowth * 8;
  const hamWidth = 8 + seedFeatures.baseBuild * 0.7 + growthParams.hamstringGrowth * 6;
  const calfWidth = 7 + seedFeatures.baseBuild * 0.5 + (growthParams.legGrowth + growthParams.hamstringGrowth * 0.3) * 4;
  const upperHeight = (26 + growthParams.quadGrowth * 12) * seedFeatures.limbLength;
  const lowerHeight = (20 + growthParams.legGrowth * 10) * seedFeatures.limbLength;
  const gap = 6 - seedFeatures.baseBuild;
  const scaleY = growthParams.legScale;
  const strokeWidth = growthParams.strokeWidth;

  return (
    <g transform={`translate(0, 132) scale(1, ${scaleY})`}>
      <rect
        x={72 - gap - quadWidth}
        y={0}
        width={quadWidth}
        height={upperHeight}
        rx={quadWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <rect
        x={72 - gap - quadWidth + (quadWidth - hamWidth) / 2}
        y={upperHeight - 2}
        width={hamWidth}
        height={lowerHeight}
        rx={hamWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <rect
        x={72 - gap - quadWidth + (quadWidth - calfWidth) / 2}
        y={upperHeight + lowerHeight - 3}
        width={calfWidth}
        height={14 + growthParams.hamstringGrowth * 6}
        rx={calfWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <rect
        x={72 + gap}
        y={0}
        width={quadWidth}
        height={upperHeight}
        rx={quadWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <rect
        x={72 + gap + (quadWidth - hamWidth) / 2}
        y={upperHeight - 2}
        width={hamWidth}
        height={lowerHeight}
        rx={hamWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <rect
        x={72 + gap + (quadWidth - calfWidth) / 2}
        y={upperHeight + lowerHeight - 3}
        width={calfWidth}
        height={14 + growthParams.hamstringGrowth * 6}
        rx={calfWidth / 2}
        fill={bodyColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}
