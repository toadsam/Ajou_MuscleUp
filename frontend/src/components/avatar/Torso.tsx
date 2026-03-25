import type { GrowthParams } from "./types";
import type { SeededFeatures } from "./seed";

type Props = {
  growthParams: GrowthParams;
  seedFeatures: SeededFeatures;
  strokeColor: string;
  suitColor: string;
};

export default function Torso({ growthParams, seedFeatures, strokeColor, suitColor }: Props) {
  const shoulder = 44 + growthParams.armGrowth * 9 + growthParams.shoulderGrowth * 16 + seedFeatures.baseBuild * 2.5;
  const chest = 36 + growthParams.chestGrowth * 20;
  const waist = 30 + growthParams.torsoGrowth * 10 + growthParams.fatNormalized * 6;
  const lat = 34 + growthParams.backGrowth * 22;
  const hip = 38 + growthParams.gluteGrowth * 10 + growthParams.fatNormalized * 8;
  const strokeWidth = growthParams.strokeWidth;
  const detailOpacity = growthParams.muscleDetailOpacity;
  const fatShadeOpacity = growthParams.fatShadowOpacity;
  const contrast = growthParams.contrastBoost;

  const torsoPath = `M ${72 - shoulder / 2} 56
    Q ${72 - (chest / 2 + lat * 0.2)} 74, ${72 - chest / 2} 86
    Q ${72 - waist / 2} 102, ${72 - waist / 2} 111
    Q ${72 - hip / 2} 126, ${72 - hip * 0.43} 132
    L ${72 + hip * 0.43} 132
    Q ${72 + hip / 2} 126, ${72 + waist / 2} 111
    Q ${72 + chest / 2} 86, ${72 + (chest / 2 + lat * 0.2)} 74
    Q ${72 + shoulder / 2} 62, ${72 + shoulder / 2} 56 Z`;

  return (
    <g transform={`scale(${growthParams.torsoScaleX}, 1) translate(${72 * (1 - growthParams.torsoScaleX)}, 0)`}>
      <path d={torsoPath} fill={suitColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      <ellipse cx={72} cy={83} rx={9 + growthParams.chestGrowth * 7} ry={4 + growthParams.chestGrowth * 2} fill="#ffffff" opacity={0.12 + growthParams.chestGrowth * 0.2} />
      <path
        d={`M ${72 - chest * 0.32} 95 Q 72 102, ${72 + chest * 0.32} 95`}
        stroke="#ffffff"
        strokeWidth={1 + growthParams.chestGrowth * 1.2}
        opacity={0.14 + growthParams.chestGrowth * 0.32}
        fill="none"
      />
      <path
        d={`M ${72 - lat * 0.42} 88 Q ${72 - lat * 0.52} 104, ${72 - lat * 0.36} 116`}
        stroke="#ffffff"
        strokeWidth={1 + growthParams.backGrowth * 1.1}
        opacity={0.1 + growthParams.backGrowth * 0.28}
        fill="none"
      />
      <path
        d={`M ${72 + lat * 0.42} 88 Q ${72 + lat * 0.52} 104, ${72 + lat * 0.36} 116`}
        stroke="#ffffff"
        strokeWidth={1 + growthParams.backGrowth * 1.1}
        opacity={0.1 + growthParams.backGrowth * 0.28}
        fill="none"
      />
      <path
        d={`M 72 67 L 72 121 M 62 84 Q 72 92, 82 84`}
        stroke="#ffffff"
        strokeWidth={1.5 + detailOpacity * 1.8}
        opacity={0.2 + detailOpacity * 0.55}
        filter={`contrast(${contrast})`}
      />
      <ellipse cx={72} cy={116} rx={18} ry={10} fill="#000000" opacity={0.08 + fatShadeOpacity * 0.24} />
    </g>
  );
}
