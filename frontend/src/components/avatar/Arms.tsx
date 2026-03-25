import type { GrowthParams } from "./types";
import type { SeededFeatures } from "./seed";

type Props = {
  growthParams: GrowthParams;
  tierBoost?: number;
  seedFeatures: SeededFeatures;
  strokeColor: string;
  skinColor: string;
};

export default function Arms({ growthParams, tierBoost = 0, seedFeatures, strokeColor, skinColor }: Props) {
  const sensitiveGrowth = Math.min(1, Math.max(0, growthParams.armGrowth * 1.35 + 0.08));
  const baseUpper = 9 + seedFeatures.baseBuild;
  const baseLower = 7 + seedFeatures.baseBuild * 0.5;
  const bicepsBulge = 1 + sensitiveGrowth * 0.95 + tierBoost * 0.18;
  const forearmBulge = 1 + sensitiveGrowth * 0.45 + tierBoost * 0.12;
  const upperWidth = baseUpper * bicepsBulge;
  const lowerWidth = baseLower * forearmBulge;
  const upperHeight = 25 + sensitiveGrowth * 7;
  const lowerHeight = 24 + sensitiveGrowth * 6;
  const elbowY = upperHeight - 2;
  const strokeWidth = growthParams.strokeWidth;
  const scale = growthParams.armScale + tierBoost * 0.04;
  const leftX = 34;
  const rightX = 102;

  return (
    <g transform={`translate(0, 62) scale(${scale}, 1) translate(${72 * (1 - scale)}, 0)`}>
      <g>
        <rect
          x={leftX}
          y={0}
          width={upperWidth}
          height={upperHeight}
          rx={upperWidth / 2}
          fill={skinColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <ellipse
          cx={leftX + upperWidth * 0.62}
          cy={upperHeight * 0.46}
          rx={upperWidth * 0.38}
          ry={upperHeight * 0.24}
          fill="#ffffff"
          opacity={0.14 + sensitiveGrowth * 0.24}
        />
        <circle cx={leftX + upperWidth / 2} cy={elbowY} r={2.2 + sensitiveGrowth * 1.2} fill={strokeColor} opacity={0.45} />
        <rect
          x={leftX + (upperWidth - lowerWidth) / 2}
          y={elbowY + 2}
          width={lowerWidth}
          height={lowerHeight}
          rx={lowerWidth / 2}
          fill={skinColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </g>
      <g>
        <rect
          x={rightX}
          y={0}
          width={upperWidth}
          height={upperHeight}
          rx={upperWidth / 2}
          fill={skinColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <ellipse
          cx={rightX + upperWidth * 0.38}
          cy={upperHeight * 0.46}
          rx={upperWidth * 0.38}
          ry={upperHeight * 0.24}
          fill="#ffffff"
          opacity={0.14 + sensitiveGrowth * 0.24}
        />
        <circle cx={rightX + upperWidth / 2} cy={elbowY} r={2.2 + sensitiveGrowth * 1.2} fill={strokeColor} opacity={0.45} />
        <rect
          x={rightX + (upperWidth - lowerWidth) / 2}
          y={elbowY + 2}
          width={lowerWidth}
          height={lowerHeight}
          rx={lowerWidth / 2}
          fill={skinColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </g>
    </g>
  );
}
