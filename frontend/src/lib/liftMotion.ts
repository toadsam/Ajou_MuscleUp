// 운동 세션에서 캐릭터가 따라 하는 동작 — 종목마다 어떤 자세 · 어떤 기구인지
import type { ActionKind, Equip, PixelPlate } from "../components/avatar/pixelAvatar";
import { platesForKg, type PlateSpec } from "../components/gym/plates";
import type { LiftCategory, LiftExerciseInfo } from "./lifts";

export type LiftMotion = { kind: ActionKind; equip: Equip };

/** 기본 종목(서버 LiftExercise 코드) */
const BY_CODE: Record<string, LiftMotion> = {
  SQUAT: { kind: "squat", equip: "barbell" },
  FRONT_SQUAT: { kind: "squat", equip: "barbell" },
  LUNGE: { kind: "squat", equip: "dumbbell" },
  LEG_PRESS: { kind: "squat", equip: "machine" },
  LEG_EXTENSION: { kind: "squat", equip: "machine" },
  LEG_CURL: { kind: "squat", equip: "machine" },
  CALF_RAISE: { kind: "squat", equip: "machine" },
  ROMANIAN_DEADLIFT: { kind: "deadlift", equip: "barbell" },
  DEADLIFT: { kind: "deadlift", equip: "barbell" },
  ROW: { kind: "deadlift", equip: "barbell" },
  SEATED_ROW: { kind: "deadlift", equip: "machine" },
  DB_ROW: { kind: "deadlift", equip: "dumbbell" },
  PULL_UP: { kind: "pullup", equip: "none" },
  LAT_PULLDOWN: { kind: "pullup", equip: "machine" },
  BENCH: { kind: "bench", equip: "barbell" },
  INCLINE_BENCH: { kind: "bench", equip: "barbell" },
  DB_BENCH: { kind: "bench", equip: "dumbbell" },
  CHEST_FLY: { kind: "fly", equip: "dumbbell" },
  CABLE_CROSSOVER: { kind: "fly", equip: "machine" },
  DIPS: { kind: "pushup", equip: "none" },
  PUSH_UP: { kind: "pushup", equip: "none" },
  OHP: { kind: "press", equip: "barbell" },
  DB_SHOULDER_PRESS: { kind: "press", equip: "dumbbell" },
  LATERAL_RAISE: { kind: "raise", equip: "dumbbell" },
  REAR_DELT_FLY: { kind: "raise", equip: "dumbbell" },
  BARBELL_CURL: { kind: "curl", equip: "barbell" },
  DB_CURL: { kind: "curl", equip: "dumbbell" },
  TRICEP_PUSHDOWN: { kind: "curl", equip: "machine" },
  SKULL_CRUSHER: { kind: "curl", equip: "barbell" },
  CRUNCH: { kind: "legraise", equip: "none" },
  HANGING_LEG_RAISE: { kind: "legraise", equip: "none" },
};

/** 직접 추가한 종목은 부위로 고른다(기구를 모르니 맨손) */
const BY_CATEGORY: Record<LiftCategory, ActionKind> = {
  LEGS: "squat",
  CHEST: "bench",
  BACK: "deadlift",
  SHOULDERS: "press",
  ARMS: "curl",
  CORE: "legraise",
  OTHER: "flex",
};

export function motionFor(info: LiftExerciseInfo | null | undefined): LiftMotion {
  if (!info) return { kind: "flex", equip: "none" };
  const known = BY_CODE[info.code];
  if (known) return known;
  return { kind: BY_CATEGORY[info.category] ?? "flex", equip: info.bodyweight ? "none" : "machine" };
}

/** 그림에 쓸 원판: 큰 원판(10kg 이상) · 5kg · 그보다 작은 것 */
export const pixelPlates = (side: PlateSpec[]): PixelPlate[] =>
  side.map((p) => ({ color: p.color, size: p.kg >= 10 ? 0 : p.kg >= 5 ? 1 : 2 }));

/** 바벨 무게 → 한쪽 원판(그림용 · 화면 글자용) */
export function barbellLoad(totalKg: number) {
  const { side, rest } = platesForKg(totalKg);
  return { side, rest, pixel: pixelPlates(side) };
}
