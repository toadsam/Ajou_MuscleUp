// 운동 기록 · 개인 최고(PR F) — 서버 LiftService 와 같은 모양
export type LiftExerciseCode =
  | "SQUAT"
  | "BENCH"
  | "DEADLIFT"
  | "OHP"
  | "ROW"
  | "INCLINE_BENCH"
  | "LEG_PRESS"
  | "LAT_PULLDOWN";

/** 서버 LiftExercise 와 같은 순서 · 이름. 3대는 개인 최고가 마이페이지 3대 기록에도 반영된다 */
export const LIFT_EXERCISES: { code: LiftExerciseCode; label: string; bigThree: boolean }[] = [
  { code: "SQUAT", label: "스쿼트", bigThree: true },
  { code: "BENCH", label: "벤치프레스", bigThree: true },
  { code: "DEADLIFT", label: "데드리프트", bigThree: true },
  { code: "OHP", label: "오버헤드프레스", bigThree: false },
  { code: "ROW", label: "바벨로우", bigThree: false },
  { code: "INCLINE_BENCH", label: "인클라인 벤치", bigThree: false },
  { code: "LEG_PRESS", label: "레그프레스", bigThree: false },
  { code: "LAT_PULLDOWN", label: "랫풀다운", bigThree: false },
];

export type LiftEntry = {
  id: number;
  date: string;
  exercise: LiftExerciseCode;
  label: string;
  weightKg: number;
  reps: number;
  sets: number;
  e1rm: number;
};

export type LiftPr = { exercise: LiftExerciseCode; label: string; previousE1rm: number | null; e1rm: number; first: boolean };

export type LiftStatUpdate = { exercise: LiftExerciseCode; label: string; before: number | null; after: number };

export type LiftSaveResult = {
  entry: LiftEntry;
  pr: LiftPr | null;
  statUpdate: LiftStatUpdate | null;
  points: number;
};

export type LiftDay = { date: string; today: string; entries: LiftEntry[] };

export type LiftBest = { exercise: LiftExerciseCode; label: string; bigThree: boolean; e1rm: number; maxWeightKg: number };

export type LiftPoint = { date: string; e1rm: number };

/** 추정 1RM(Epley) — 서버와 같은 식, 입력하는 동안 미리 보여 주기용 */
export function estimate1rm(weightKg: number, reps: number) {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  return Math.round((reps <= 1 ? weightKg : weightKg * (1 + reps / 30)) * 10) / 10;
}

export const formatKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, ""));
