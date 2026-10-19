// 개발 전용: 전투 장면 연출을 가짜 공격으로 돌려 본다(로그인 없이). App.tsx 에서 DEV 일 때만 라우트를 연다.
import { useState } from "react";
import BossFight, { type FightMotion } from "../components/boss/BossFight";
import type { StageCharacter } from "../components/workout/LiftStage";
import { defaultGrowthParams } from "../components/avatar/types";
import { barbellLoad } from "../lib/liftMotion";
import type { ShadowHit } from "../lib/shadow";

const CHARACTER: StageCharacter = {
  avatarSeed: "dev-boss",
  tier: "GOLD",
  evolutionStage: 3,
  gender: "MALE",
  growthParams: { ...defaultGrowthParams, muscularityNormalized: 0.6, shoulderGrowth: 0.6 },
};

const base: Omit<ShadowHit, "id"> = {
  source: "SESSION",
  hitOn: "2026-10-15",
  hp: 100,
  raw: 60,
  damage: 60,
  crit: false,
  hpBefore: 100,
  hpAfter: 40,
  killed: false,
  overkillPct: 0,
  reward: null,
};

const CASES: { label: string; hit: ShadowHit; motion: FightMotion }[] = [
  { label: "보통 — 스쿼트 6,000kg → 힘 60", hit: { ...base, id: 1 }, motion: { kind: "squat", equip: "barbell", plates: barbellLoad(100).pixel } },
  {
    label: "치명타 — 러닝 5.2km 기록 갱신, Lv20 ×1.7",
    hit: { ...base, id: 2, source: "RUN", hp: 420, raw: 52, damage: 88, crit: true, hpBefore: 420, hpAfter: 332 },
    motion: { kind: "run", equip: "none" },
  },
  {
    label: "처치 — 남은 40 에 힘 60",
    hit: { ...base, id: 3, hpBefore: 40, hpAfter: 0, killed: true, overkillPct: 20, reward: { points: 10, box: 1, titles: ["그림자를 넘은 자"] } },
    motion: { kind: "bench", equip: "barbell", plates: barbellLoad(80).pixel },
  },
  {
    label: "치명타 + 처치 — 4주 연속",
    hit: {
      ...base,
      id: 4,
      hp: 200,
      raw: 150,
      damage: 226,
      crit: true,
      hpBefore: 180,
      hpAfter: 0,
      killed: true,
      overkillPct: 13,
      reward: { points: 10, box: 1, titles: ["그림자 사냥꾼"] },
    },
    motion: { kind: "deadlift", equip: "barbell", plates: barbellLoad(140).pixel },
  },
  { label: "하루 상한 — 세 번째 세션, 힘 100 이 0 으로", hit: { ...base, id: 5, hp: 1050, raw: 100, damage: 0, hpBefore: 750, hpAfter: 750 }, motion: { kind: "pullup", equip: "none" } },
  { label: "이미 쓰러짐 — 오버킬만", hit: { ...base, id: 6, hpBefore: 0, hpAfter: 0, overkillPct: 80 }, motion: { kind: "curl", equip: "dumbbell" } },
];

export default function DevBoss() {
  const [keys, setKeys] = useState<number[]>(() => CASES.map(() => 0));
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 pb-20 pt-24 text-white">
      <header className="space-y-1">
        <h1 className="text-4xl">그림자 전투 장면</h1>
        <p className="text-sm text-steel-400">가짜 공격 6종. 각 칸의 "다시"로 처음부터. 375px 폭도 여기서 본다.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {CASES.map((c, i) => (
          <section key={c.hit.id} className="space-y-2">
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
            <BossFight hit={c.hit} character={CHARACTER} mbti="ESTJ" motion={c.motion} replayKey={keys[i]} />
          </section>
        ))}
      </div>
    </main>
  );
}
