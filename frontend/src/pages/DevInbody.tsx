// 개발 전용: 인바디 판정 장면을 가짜 결과로 돌려 본다(로그인 없이). App.tsx 에서 DEV 일 때만 라우트를 연다.
import { useState } from "react";
import InbodyVerdict from "../components/inbody/InbodyVerdict";
import type { StageCharacter } from "../components/workout/LiftStage";
import { defaultGrowthParams } from "../components/avatar/types";
import { buildInbodyVerdict, type VerdictContext } from "../lib/inbodyVerdict";

const CHARACTER: StageCharacter = {
  avatarSeed: "dev-inbody",
  tier: "GOLD",
  evolutionStage: 3,
  gender: "MALE",
  growthParams: { ...defaultGrowthParams, muscularityNormalized: 0.6, shoulderGrowth: 0.6 },
};

const MALE_24: VerdictContext = { gender: "MALE", age: 24, heightCm: 176 };
const FEMALE_22: VerdictContext = { gender: "FEMALE", age: 22, heightCm: 163 };

type Case = {
  label: string;
  metrics: Record<string, string>;
  confidence: number;
  reviewRequired: boolean;
  context: VerdictContext;
  character?: StageCharacter | null;
};

const CASES: Case[] = [
  {
    label: "탄탄 — 점수 78, 남 24세 176cm",
    metrics: { inbody_score: "78", skeletal_muscle_kg: "33.2", body_fat_percent: "18.4", bmi: "23.1", visceral_fat_level: "6", weight_kg: "71.5" },
    confidence: 92,
    reviewRequired: false,
    context: MALE_24,
  },
  {
    label: "강철 — 점수 88, 네 칸 모두 좋음",
    metrics: { inbody_score: "88", skeletal_muscle_kg: "38.0", body_fat_percent: "12.1", bmi: "24.0", visceral_fat_level: "4" },
    confidence: 96,
    reviewRequired: false,
    context: MALE_24,
  },
  {
    label: "출발선 — 점수 64, 체지방 31% (수치심 안 주는지)",
    metrics: { inbody_score: "64", skeletal_muscle_kg: "26.5", body_fat_percent: "31.0", bmi: "27.2", visceral_fat_level: "13" },
    confidence: 90,
    reviewRequired: false,
    context: MALE_24,
    character: { ...CHARACTER, avatarSeed: "dev-inbody-start", tier: "BRONZE", evolutionStage: 1, growthParams: { ...defaultGrowthParams, muscularityNormalized: 0.2 } },
  },
  {
    label: "점수 없음(직접 입력) — 네 칸 합으로, 여 22세",
    metrics: { skeletal_muscle_kg: "21.8", body_fat_percent: "30.0", bmi: "21.0", visceral_fat_level: "9" },
    confidence: 100,
    reviewRequired: false,
    context: FEMALE_22,
    character: { ...CHARACTER, avatarSeed: "dev-inbody-f", gender: "FEMALE", tier: "SILVER" },
  },
  {
    label: "보류 — 수치 확인 필요(reviewRequired)",
    metrics: { inbody_score: "81", skeletal_muscle_kg: "3.2", body_fat_percent: "18.4", bmi: "23.1", visceral_fat_level: "6" },
    confidence: 71,
    reviewRequired: true,
    context: MALE_24,
  },
  {
    label: "보류 — 체중만 있음 · 캐릭터 없음",
    metrics: { weight_kg: "70" },
    confidence: 100,
    reviewRequired: false,
    context: { gender: "", age: 0, heightCm: 0 },
    character: null,
  },
];

export default function DevInbody() {
  const [keys, setKeys] = useState<number[]>(() => CASES.map(() => 0));
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 pb-20 pt-24 text-white">
      <header className="space-y-1">
        <h1 className="font-display text-4xl">인바디 판정 장면</h1>
        <p className="text-sm text-steel-400">가짜 결과 6종. 각 칸의 "다시"로 처음부터. 375px 폭도 여기서 본다. 보류 칸의 "숫자 확인하기"는 알림만.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {CASES.map((c, i) => {
          const verdict = buildInbodyVerdict({ metrics: c.metrics, confidence: c.confidence, reviewRequired: c.reviewRequired, context: c.context });
          const character = c.character === undefined ? CHARACTER : c.character;
          return (
            <section key={c.label} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-steel-300">
                <span>{c.label}</span>
                <button
                  type="button"
                  className="dg-btn dg-btn-steel min-h-[28px] px-3 text-xs"
                  onClick={() => setKeys((k) => k.map((v, j) => (j === i ? v + 1 : v)))}
                >
                  다시
                </button>
              </div>
              <InbodyVerdict
                verdict={verdict}
                confidence={c.confidence}
                character={character}
                replayKey={keys[i]}
                onConfirm={verdict.held ? () => window.alert("상담 화면에서는 입력값 재확인 칸으로 내려가요.") : undefined}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}
