// 인바디 판정 — 상담 결과의 핵심 4칸(골격근량 · 체지방률 · BMI · 내장지방)을 "좋음 · 보통 · 다음 목표"로 읽고,
// 인바디 점수(없으면 네 칸의 합)로 "오늘 올린 원판"(5 · 10 · 15 · 20 · 25kg)을 정한다.
// 체성분은 건강 정보라 낮은 쪽도 "패배"가 아니라 출발선으로 부른다. 기준값은 InbodyConsult 의 개인 기준 해석과 같다
// (성별 · 나이 · 키 보정). 화면은 components/inbody/InbodyVerdict.tsx.

export type VerdictGender = "MALE" | "FEMALE" | "";
export type VerdictContext = { gender: VerdictGender; age: number; heightCm: number };

export type StatStatus = "good" | "mid" | "watch" | "none";

export type VerdictStat = {
  key: "muscle" | "fat" | "bmi" | "visceral";
  label: string;
  value: number | null;
  unit: string;
  decimals: number;
  status: StatStatus;
  /** 칩에 찍히는 짧은 말 */
  badge: string;
};

export type VerdictGrade = {
  kg: 5 | 10 | 15 | 20 | 25;
  name: string;
  color: string;
  ink: string;
  /** 판정 아래 한 줄 */
  line: string;
};

export type InbodyVerdict = {
  stats: VerdictStat[];
  score: number | null;
  /** 보류면 null */
  grade: VerdictGrade | null;
  held: boolean;
  holdReason: string | null;
};

export const STATUS_BADGE: Record<StatStatus, string> = { good: "좋음", mid: "보통", watch: "다음 목표", none: "미입력" };

const GRADES: VerdictGrade[] = [
  { kg: 5, name: "출발선", color: "#E8E6E0", ink: "#0E0E10", line: "지금이 기준점이에요. 다음 인바디가 첫 비교가 돼요." },
  { kg: 10, name: "기본기", color: "#2E9C55", ink: "#FFFFFF", line: "기본은 갖췄어요. '다음 목표' 칸 하나만 집중하면 다음 원판이 보여요." },
  { kg: 15, name: "탄탄", color: "#F0BE2E", ink: "#0E0E10", line: "균형이 잡혀 있어요. 약한 칸 하나를 끌어올릴 때예요." },
  { kg: 20, name: "단단", color: "#2F6FD0", ink: "#FFFFFF", line: "대부분 좋은 구간이에요. 유지가 곧 성장이에요." },
  { kg: 25, name: "강철", color: "#D9302A", ink: "#FFFFFF", line: "모든 칸이 좋은 범위예요. 이 상태를 기록으로 남겨요." },
];

export const toNum = (raw: string | number | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ---- 기준값 (InbodyConsult.tsx 의 개인 기준 해석도 이걸 쓴다) ----

export function getBodyFatThreshold(gender: VerdictGender, age: number) {
  let good = gender === "FEMALE" ? 28 : 20;
  let caution = gender === "FEMALE" ? 33 : 25;
  if (age >= 40 && age < 60) {
    good += 1;
    caution += 1;
  } else if (age >= 60) {
    good += 2;
    caution += 2;
  }
  return { good, caution };
}

export function getBmiThreshold(age: number) {
  const normalHigh = age >= 60 ? 24 : 23;
  const cautionHigh = age >= 60 ? 26 : 25;
  return { normalLow: 18.5, normalHigh, cautionHigh };
}

export function getVisceralFatThreshold(gender: VerdictGender, age: number) {
  let stableMax = gender === "FEMALE" ? 8 : 9;
  let cautionMax = gender === "FEMALE" ? 11 : 12;
  if (age >= 60) {
    stableMax += 1;
    cautionMax += 1;
  }
  return { stableMax, cautionMax };
}

export function getSkeletalMuscleThreshold(gender: VerdictGender, age: number) {
  const isFemale = gender === "FEMALE";
  const low = isFemale ? (age >= 60 ? 6 : 6.4) : age >= 60 ? 7.3 : 7.8;
  const good = isFemale ? (age >= 60 ? 7.1 : 7.6) : age >= 60 ? 8.6 : 9.2;
  return { low, good };
}

// ---- 칸별 판정 ----

export function muscleStatus(kg: number | null, ctx: VerdictContext): StatStatus {
  if (kg === null) return "none";
  if (ctx.heightCm <= 0) return kg < 18 ? "watch" : kg < 24 ? "mid" : "good";
  const m = ctx.heightCm / 100;
  const smi = kg / (m * m);
  const t = getSkeletalMuscleThreshold(ctx.gender, ctx.age);
  return smi < t.low ? "watch" : smi < t.good ? "mid" : "good";
}

export function bodyFatStatus(pct: number | null, ctx: VerdictContext): StatStatus {
  if (pct === null) return "none";
  if (!ctx.gender && !ctx.age) return pct < 20 ? "good" : pct < 28 ? "mid" : "watch";
  const t = getBodyFatThreshold(ctx.gender, ctx.age);
  return pct <= t.good ? "good" : pct <= t.caution ? "mid" : "watch";
}

export function bmiStatus(bmi: number | null, ctx: VerdictContext): StatStatus {
  if (bmi === null) return "none";
  const t = getBmiThreshold(ctx.age);
  if (bmi < t.normalLow) return "mid";
  if (bmi < t.normalHigh) return "good";
  if (bmi < t.cautionHigh) return "mid";
  return "watch";
}

export function visceralStatus(level: number | null, ctx: VerdictContext): StatStatus {
  if (level === null) return "none";
  if (!ctx.gender && !ctx.age) return level <= 9 ? "good" : level <= 12 ? "mid" : "watch";
  const t = getVisceralFatThreshold(ctx.gender, ctx.age);
  return level <= t.stableMax ? "good" : level <= t.cautionMax ? "mid" : "watch";
}

/** 인바디 점수 → 원판. 70 미만은 출발선, 85 이상은 강철 */
export function gradeForScore(score: number): VerdictGrade {
  if (score < 70) return GRADES[0];
  if (score < 75) return GRADES[1];
  if (score < 80) return GRADES[2];
  if (score < 85) return GRADES[3];
  return GRADES[4];
}

/** 점수가 없을 때: 네 칸(좋음 2 · 보통 1 · 다음 목표 0)의 비율로 */
export function gradeForStats(stats: VerdictStat[]): VerdictGrade | null {
  const known = stats.filter((s) => s.status !== "none");
  if (known.length === 0) return null;
  const points = known.reduce((sum, s) => sum + (s.status === "good" ? 2 : s.status === "mid" ? 1 : 0), 0);
  const ratio = points / (known.length * 2);
  if (ratio < 0.25) return GRADES[0];
  if (ratio < 0.5) return GRADES[1];
  if (ratio < 0.75) return GRADES[2];
  if (ratio < 1) return GRADES[3];
  return GRADES[4];
}

type BuildInput = {
  metrics: Record<string, string | number | null | undefined>;
  confidence: number;
  reviewRequired: boolean;
  context: VerdictContext;
};

/** 신뢰도가 이보다 낮으면 판정을 찍지 않고 숫자 확인부터 */
export const HOLD_BELOW_CONFIDENCE = 60;

export function buildInbodyVerdict({ metrics, confidence, reviewRequired, context }: BuildInput): InbodyVerdict {
  const muscle = toNum(metrics.skeletal_muscle_kg);
  const fat = toNum(metrics.body_fat_percent);
  const bmi = toNum(metrics.bmi);
  const visceral = toNum(metrics.visceral_fat_level);
  const score = toNum(metrics.inbody_score);

  const stat = (key: VerdictStat["key"], label: string, value: number | null, unit: string, decimals: number, status: StatStatus): VerdictStat => ({
    key,
    label,
    value,
    unit,
    decimals,
    status,
    badge: STATUS_BADGE[status],
  });

  const stats: VerdictStat[] = [
    stat("muscle", "골격근량", muscle, "kg", 1, muscleStatus(muscle, context)),
    stat("fat", "체지방률", fat, "%", 1, bodyFatStatus(fat, context)),
    stat("bmi", "BMI", bmi, "", 1, bmiStatus(bmi, context)),
    stat("visceral", "내장지방", visceral, "Lv", 0, visceralStatus(visceral, context)),
  ];

  const knownCount = stats.filter((s) => s.status !== "none").length;
  let holdReason: string | null = null;
  if (reviewRequired) holdReason = "읽어 낸 숫자에 확실하지 않은 칸이 있어요. 아래에서 한 번 확인하면 판정을 찍어요.";
  else if (confidence < HOLD_BELOW_CONFIDENCE) holdReason = `읽기 신뢰도가 ${Math.round(confidence)}% 라 숫자를 먼저 확인해요.`;
  else if (knownCount === 0 && score === null) holdReason = "판정에 쓸 숫자가 없어요. 골격근량 · 체지방률 중 하나라도 넣으면 찍어요.";

  const grade = holdReason ? null : score !== null ? gradeForScore(score) : gradeForStats(stats);

  return { stats, score, grade, held: grade === null, holdReason: grade === null ? holdReason ?? "판정에 쓸 숫자가 없어요." : null };
}
