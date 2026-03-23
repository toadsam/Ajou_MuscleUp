import type { Mbti } from "./types";
import type { SeededFeatures } from "./seed";

type Props = {
  gender?: "MALE" | "FEMALE" | null;
  mbti?: string | null;
  isResting?: boolean;
  seedFeatures: SeededFeatures;
  strokeColor: string;
  skinColor: string;
  hairColor: string;
};

const eyeByMbti = (mbti?: string | null) => {
  const normalized = mbti?.toUpperCase() as Mbti | undefined;
  if (!normalized) return "neutral";
  if (normalized.includes("N")) return "sharp";
  if (normalized.includes("F")) return "soft";
  if (normalized.includes("T")) return "focused";
  return "neutral";
};

const expressionByMbti = (mbti?: string | null) => {
  const normalized = mbti?.toUpperCase() as Mbti | undefined;
  if (!normalized) return "line";
  if (normalized.startsWith("E")) return "smile";
  if (normalized.startsWith("I")) return "calm";
  return "line";
};

const faceRadii = [
  { rx: 13.5, ry: 16.5 },
  { rx: 16.5, ry: 14.8 },
  { rx: 14.4, ry: 17.2 },
  { rx: 15.8, ry: 15.8 },
  { rx: 12.8, ry: 15.6 },
  { rx: 17.1, ry: 14.2 },
  { rx: 14.8, ry: 14.8 },
];

export default function Head({ gender = "MALE", mbti, isResting = false, seedFeatures, strokeColor, skinColor, hairColor }: Props) {
  const baseEyeStyle = eyeByMbti(mbti) === "neutral" ? seedFeatures.eyeStyle : 0;
  const expression = isResting ? "tired" : expressionByMbti(mbti);
  const face = faceRadii[seedFeatures.faceShape % faceRadii.length];
  const feminine = gender === "FEMALE";
  const faceRx = face.rx * seedFeatures.jawWidth * (feminine ? 0.92 : 1);
  const faceRy = face.ry * seedFeatures.cheekDepth * (feminine ? 1.03 : 1);
  const eyeDist = 6.5 * seedFeatures.eyeSpacing;
  const browTilt = seedFeatures.browTilt;
  const mouthHalf = 5.6 * seedFeatures.mouthWidth;
  const noseHeight = 4.2 * seedFeatures.noseHeight;
  const earRx = 2.2 * seedFeatures.earSize;
  const earRy = 3.5 * seedFeatures.earSize;
  const hairVolume = seedFeatures.hairVolume * (feminine ? 1.18 : 1);

  return (
    <g>
      <ellipse cx={72} cy={38} rx={faceRx} ry={faceRy} fill={skinColor} stroke={strokeColor} strokeWidth={2.4} />
      <ellipse cx={72 - faceRx - 1} cy={39} rx={earRx} ry={earRy} fill={skinColor} stroke={strokeColor} strokeWidth={1.3} />
      <ellipse cx={72 + faceRx + 1} cy={39} rx={earRx} ry={earRy} fill={skinColor} stroke={strokeColor} strokeWidth={1.3} />
      <rect x={66 - seedFeatures.neckWidth * 2.2} y={50} width={12 + seedFeatures.neckWidth * 2.4} height={10} rx={4} fill={skinColor} />

      {seedFeatures.hairStyle === 0 && <path d={`M ${58 - hairVolume * 3} 33 Q 72 10, ${86 + hairVolume * 3} 33 L 88 37 Q 72 31 56 37 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 1 && <path d={`M 56 36 Q 72 18, 88 36 Q 72 ${28 - hairVolume * 2} 56 36 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 2 && <path d={`M 54 36 Q 72 14, 90 36 L 86 44 Q 72 36 58 44 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 3 && <path d={`M 58 29 Q 72 8, 86 29 Q 72 34 58 29`} fill={hairColor} />}
      {seedFeatures.hairStyle === 4 && <path d={`M 55 37 Q 72 17, 89 37 Q 72 ${38 + hairVolume * 2} 55 37`} fill={hairColor} />}
      {seedFeatures.hairStyle === 5 && <path d={`M 57 31 L 64 19 L 72 29 L 80 19 L 87 31 L 85 39 Q 72 33 59 39 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 6 && <path d={`M 56 34 Q 72 12, 88 34 L 88 38 Q 72 34 56 38 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 7 && <path d={`M 54 34 Q 72 20, 90 34 Q 72 ${24 - hairVolume * 2} 54 34 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 8 && <path d={`M 58 31 Q 72 16, 86 31 L 83 43 Q 72 36 61 43 Z`} fill={hairColor} />}
      {seedFeatures.hairStyle === 9 && <path d={`M 56 33 Q 72 12, 88 33 L 88 40 Q 72 34 56 40 Z`} fill={hairColor} />}
      {feminine && (
        <>
          <path d={`M 55 29 Q 50 45 55 60 Q 60 55 61 44 Q 61 ${26 + hairVolume * 2} 55 29 Z`} fill={hairColor} opacity={0.98} />
          <path d={`M 89 29 Q 94 45 89 60 Q 84 55 83 44 Q 83 ${26 + hairVolume * 2} 89 29 Z`} fill={hairColor} opacity={0.98} />
          <path d="M 62 21 Q 72 13 82 21" stroke="#f9a8d4" strokeWidth={2.1} strokeLinecap="round" opacity={0.95} />
          <circle cx={60} cy={22} r={2.3} fill="#f9a8d4" opacity={0.95} />
          <circle cx={84} cy={22} r={2.3} fill="#f9a8d4" opacity={0.95} />
        </>
      )}

      <path d={`M ${72 - eyeDist - 3} ${32 + browTilt * 0.06} Q ${72 - eyeDist} ${31 + browTilt * 0.08}, ${72 - eyeDist + 3} ${32 - browTilt * 0.06}`} stroke="#0f172a" strokeWidth={1.4} strokeLinecap="round" />
      <path d={`M ${72 + eyeDist - 3} ${32 - browTilt * 0.06} Q ${72 + eyeDist} ${31 - browTilt * 0.08}, ${72 + eyeDist + 3} ${32 + browTilt * 0.06}`} stroke="#0f172a" strokeWidth={1.4} strokeLinecap="round" />

      {(baseEyeStyle % 5) === 0 && (
        <>
          <circle cx={72 - eyeDist} cy={37} r={1.7} fill="#0f172a" />
          <circle cx={72 + eyeDist} cy={37} r={1.7} fill="#0f172a" />
        </>
      )}
      {(baseEyeStyle % 5) === 1 && (
        <>
          <path d={`M ${72 - eyeDist - 2.4} 37 Q ${72 - eyeDist} 35.4, ${72 - eyeDist + 2.4} 37`} stroke="#0f172a" strokeWidth={1.7} strokeLinecap="round" />
          <path d={`M ${72 + eyeDist - 2.4} 37 Q ${72 + eyeDist} 35.4, ${72 + eyeDist + 2.4} 37`} stroke="#0f172a" strokeWidth={1.7} strokeLinecap="round" />
        </>
      )}
      {(baseEyeStyle % 5) === 2 && (
        <>
          <rect x={72 - eyeDist - 2} y={36} width={4} height={2} rx={1} fill="#0f172a" />
          <rect x={72 + eyeDist - 2} y={36} width={4} height={2} rx={1} fill="#0f172a" />
        </>
      )}
      {(baseEyeStyle % 5) === 3 && (
        <>
          <path d={`M ${72 - eyeDist - 2.4} 38 L ${72 - eyeDist + 2.4} 36`} stroke="#0f172a" strokeWidth={1.6} strokeLinecap="round" />
          <path d={`M ${72 + eyeDist - 2.4} 36 L ${72 + eyeDist + 2.4} 38`} stroke="#0f172a" strokeWidth={1.6} strokeLinecap="round" />
        </>
      )}
      {(baseEyeStyle % 5) === 4 && (
        <>
          <ellipse cx={72 - eyeDist} cy={37} rx={2.3} ry={1.4} fill="#ffffff" />
          <ellipse cx={72 + eyeDist} cy={37} rx={2.3} ry={1.4} fill="#ffffff" />
          <circle cx={72 - eyeDist} cy={37} r={0.9} fill="#0f172a" />
          <circle cx={72 + eyeDist} cy={37} r={0.9} fill="#0f172a" />
        </>
      )}

      {feminine && (
        <>
          <path d={`M ${72 - eyeDist - 2.8} 34.7 L ${72 - eyeDist - 4.2} 33.6`} stroke="#0f172a" strokeWidth={1.2} strokeLinecap="round" />
          <path d={`M ${72 - eyeDist + 2.8} 34.7 L ${72 - eyeDist + 4.2} 33.6`} stroke="#0f172a" strokeWidth={1.2} strokeLinecap="round" />
          <path d={`M ${72 + eyeDist - 2.8} 34.7 L ${72 + eyeDist - 4.2} 33.6`} stroke="#0f172a" strokeWidth={1.2} strokeLinecap="round" />
          <path d={`M ${72 + eyeDist + 2.8} 34.7 L ${72 + eyeDist + 4.2} 33.6`} stroke="#0f172a" strokeWidth={1.2} strokeLinecap="round" />
          <ellipse cx={72 - 8.2} cy={43.5} rx={2.4} ry={1.5} fill="#fda4af" opacity={0.3} />
          <ellipse cx={72 + 8.2} cy={43.5} rx={2.4} ry={1.5} fill="#fda4af" opacity={0.3} />
        </>
      )}

      <path d={`M 72 39 L 71.6 ${39 + noseHeight} Q 72 ${40 + noseHeight + 1.1}, 72.4 ${39 + noseHeight}`} stroke="#8b5e3c" strokeWidth={1.1} fill="none" strokeLinecap="round" />

      {expression === "smile" && (
        <path d={`M ${72 - mouthHalf} 47 Q 72 53, ${72 + mouthHalf} 47`} stroke="#0f172a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      )}
      {expression === "calm" && (
        <path d={`M ${72 - mouthHalf} 47 H ${72 + mouthHalf}`} stroke="#0f172a" strokeWidth={1.5} strokeLinecap="round" />
      )}
      {expression === "line" && (
        <path d={`M ${72 - mouthHalf} 47 Q 72 48, ${72 + mouthHalf} 47`} stroke="#0f172a" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      )}
      {expression === "tired" && (
        <>
          <path d={`M ${72 - mouthHalf} 48.4 Q 72 45.2, ${72 + mouthHalf} 48.4`} stroke="#0f172a" strokeWidth={1.7} fill="none" strokeLinecap="round" />
          <path d={`M ${72 - eyeDist - 3.1} 38.7 Q ${72 - eyeDist} 39.7, ${72 - eyeDist + 3.1} 38.7`} stroke="#334155" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
          <path d={`M ${72 + eyeDist - 3.1} 38.7 Q ${72 + eyeDist} 39.7, ${72 + eyeDist + 3.1} 38.7`} stroke="#334155" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
        </>
      )}

      {feminine && !isResting && (
        <path d={`M ${72 - mouthHalf * 0.72} 47 Q 72 50.4, ${72 + mouthHalf * 0.72} 47`} stroke="#be185d" strokeWidth={1.45} fill="none" strokeLinecap="round" opacity={0.95} />
      )}
    </g>
  );
}
