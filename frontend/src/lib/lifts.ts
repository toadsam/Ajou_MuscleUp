// 운동 기록 · 개인 최고(PR F) — 서버 LiftService 와 같은 모양
export type LiftCategory = "LEGS" | "CHEST" | "BACK" | "SHOULDERS" | "ARMS" | "CORE";

export const LIFT_CATEGORY_LABEL: Record<LiftCategory, string> = {
  LEGS: "하체",
  CHEST: "가슴",
  BACK: "등",
  SHOULDERS: "어깨",
  ARMS: "팔",
  CORE: "복근",
};

export type LiftExerciseInfo = { code: string; label: string; category: LiftCategory; bigThree: boolean; bodyweight: boolean };

/**
 * 서버 LiftExercise 와 같은 순서 · 이름(둘 다 고칠 것). 3대는 개인 최고가 마이페이지 3대 기록에도 반영된다.
 * bodyweight(맨몸)는 무게 0 가능 · 개인 최고 비교 없음(운동 세션에만).
 */
export const LIFT_EXERCISES: LiftExerciseInfo[] = [
  { code: "SQUAT", label: "스쿼트", category: "LEGS", bigThree: true, bodyweight: false },
  { code: "BENCH", label: "벤치프레스", category: "CHEST", bigThree: true, bodyweight: false },
  { code: "DEADLIFT", label: "데드리프트", category: "BACK", bigThree: true, bodyweight: false },
  { code: "OHP", label: "오버헤드프레스", category: "SHOULDERS", bigThree: false, bodyweight: false },
  { code: "ROW", label: "바벨로우", category: "BACK", bigThree: false, bodyweight: false },
  { code: "INCLINE_BENCH", label: "인클라인 벤치", category: "CHEST", bigThree: false, bodyweight: false },
  { code: "LEG_PRESS", label: "레그프레스", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "LAT_PULLDOWN", label: "랫풀다운", category: "BACK", bigThree: false, bodyweight: false },
  { code: "FRONT_SQUAT", label: "프론트 스쿼트", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "ROMANIAN_DEADLIFT", label: "루마니안 데드리프트", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "LUNGE", label: "런지", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "LEG_EXTENSION", label: "레그 익스텐션", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "LEG_CURL", label: "레그 컬", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "CALF_RAISE", label: "카프 레이즈", category: "LEGS", bigThree: false, bodyweight: false },
  { code: "DB_BENCH", label: "덤벨 벤치프레스", category: "CHEST", bigThree: false, bodyweight: false },
  { code: "CHEST_FLY", label: "체스트 플라이", category: "CHEST", bigThree: false, bodyweight: false },
  { code: "CABLE_CROSSOVER", label: "케이블 크로스오버", category: "CHEST", bigThree: false, bodyweight: false },
  { code: "DIPS", label: "딥스", category: "CHEST", bigThree: false, bodyweight: true },
  { code: "PUSH_UP", label: "푸시업", category: "CHEST", bigThree: false, bodyweight: true },
  { code: "PULL_UP", label: "턱걸이", category: "BACK", bigThree: false, bodyweight: true },
  { code: "SEATED_ROW", label: "시티드 로우", category: "BACK", bigThree: false, bodyweight: false },
  { code: "DB_ROW", label: "원암 덤벨 로우", category: "BACK", bigThree: false, bodyweight: false },
  { code: "DB_SHOULDER_PRESS", label: "덤벨 숄더프레스", category: "SHOULDERS", bigThree: false, bodyweight: false },
  { code: "LATERAL_RAISE", label: "사이드 레터럴 레이즈", category: "SHOULDERS", bigThree: false, bodyweight: false },
  { code: "REAR_DELT_FLY", label: "리어 델트 플라이", category: "SHOULDERS", bigThree: false, bodyweight: false },
  { code: "BARBELL_CURL", label: "바벨 컬", category: "ARMS", bigThree: false, bodyweight: false },
  { code: "DB_CURL", label: "덤벨 컬", category: "ARMS", bigThree: false, bodyweight: false },
  { code: "TRICEP_PUSHDOWN", label: "트라이셉스 푸시다운", category: "ARMS", bigThree: false, bodyweight: false },
  { code: "SKULL_CRUSHER", label: "라잉 트라이셉스 익스텐션", category: "ARMS", bigThree: false, bodyweight: false },
  { code: "CRUNCH", label: "크런치", category: "CORE", bigThree: false, bodyweight: true },
  { code: "HANGING_LEG_RAISE", label: "행잉 레그 레이즈", category: "CORE", bigThree: false, bodyweight: true },
];

export type LiftExerciseCode = string;

export const exerciseInfo = (code: string) => LIFT_EXERCISES.find((e) => e.code === code);

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
