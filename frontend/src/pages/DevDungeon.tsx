// 개발 전용: 던전 화면을 서버 없이 돌려 본다(로그인 없음). strike 는 lib/shadow 의 로컬 셈(서버 ShadowRules 와 같은 규칙).
// App.tsx 에서 DEV 일 때만 라우트를 연다. 375px 폭도 여기서 본다.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DungeonView from "../components/boss/DungeonView";
import type { StageCharacter } from "../components/workout/LiftStage";
import { defaultGrowthParams } from "../components/avatar/types";
import { PASSIVES, localStrike, type LocalWorld, type ShadowGrade, type ShadowHit, type ShadowSkill, type ShadowStatus } from "../lib/shadow";

const CHARACTER: StageCharacter = {
  avatarSeed: "dev-boss",
  tier: "GOLD",
  evolutionStage: 3,
  gender: "MALE",
  growthParams: { ...defaultGrowthParams, muscularityNormalized: 0.6, shoulderGrowth: 0.6 },
};

type Preset = { label: string; world: LocalWorld; stats: ShadowStatus["stats"]; rest?: boolean };

const PRESETS: Preset[] = [
  {
    label: "보통 주 — 통 5개 · 토큰 2 · 패시브 2",
    world: { hp: 420, damage: 0, level: 14, charge: { LEGS: 150, CHEST: 60, BACK: 45, ARMS: 30, RUN: 104 }, critTokens: 2, passives: [PASSIVES.BIG_THREE, PASSIVES.LONG_RUN], killed: false, rewarded: false, nextId: 1 },
    stats: { strengthKg: 327, enduranceKm: 12.4, attendanceStreak: 9, weeklyStreak: 3, level: 14 },
  },
  {
    label: "처치 직전 — 체력 100 · 하체 120",
    world: { hp: 100, damage: 0, level: 1, charge: { LEGS: 120, CHEST: 0, BACK: 0, ARMS: 0, RUN: 0 }, critTokens: 0, passives: [], killed: false, rewarded: false, nextId: 1 },
    stats: { strengthKg: 140, enduranceKm: 0, attendanceStreak: 1, weeklyStreak: 0, level: 1 },
  },
  {
    label: "빈 통 — 운동 안 한 주",
    world: { hp: 100, damage: 0, level: 1, charge: { LEGS: 0, CHEST: 0, BACK: 0, ARMS: 0, RUN: 0 }, critTokens: 0, passives: [], killed: false, rewarded: false, nextId: 1 },
    stats: { strengthKg: 0, enduranceKm: 0, attendanceStreak: 0, weeklyStreak: 0, level: 1 },
  },
  {
    label: "이미 처치 — 오버킬만",
    world: { hp: 100, damage: 130, level: 5, charge: { LEGS: 0, CHEST: 40, BACK: 0, ARMS: 25, RUN: 0 }, critTokens: 1, passives: [PASSIVES.STEADY, PASSIVES.HUNTER], killed: true, rewarded: true, nextId: 1 },
    stats: { strengthKg: 210, enduranceKm: 3.2, attendanceStreak: 4, weeklyStreak: 6, level: 5 },
  },
];

function statusOf(p: Preset): ShadowStatus {
  const w = p.world;
  return {
    name: "그림자",
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    rest: Boolean(p.rest),
    hp: w.hp,
    damage: w.damage,
    remaining: Math.max(0, w.hp - w.damage),
    killed: w.killed,
    killedAt: w.killed ? "2026-10-13T20:00:00" : null,
    overkillPct: w.damage > w.hp ? Math.round(((w.damage - w.hp) * 100) / w.hp) : 0,
    level: w.level,
    hits: [],
    streakWeeks: 0,
    lastWeek: null,
    charge: w.charge,
    chargeTotal: Object.values(w.charge).reduce((a, b) => a + b, 0),
    critTokens: w.critTokens,
    passives: w.passives,
    stats: p.stats,
  };
}

export default function DevDungeon() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState(0);
  const [round, setRound] = useState(0);
  const world = useRef<LocalWorld>(PRESETS[0].world);

  const start = (i: number) => {
    world.current = { ...PRESETS[i].world, charge: { ...PRESETS[i].world.charge } };
    setPreset(i);
    setRound((r) => r + 1);
  };

  const strike = (skill: ShadowSkill, grade: ShadowGrade, crit: boolean): Promise<ShadowHit> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        const r = localStrike(world.current, skill, grade, crit);
        if (!r) {
          reject(new Error("통이 비었어요"));
          return;
        }
        world.current = r.world;
        resolve(r.hit);
      }, 120); // 서버 왕복 흉내
    });

  if (round === 0) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-20 pt-24 text-white">
        <h1 className="text-3xl">그림자 던전 (개발)</h1>
        <p className="text-sm text-steel-400">서버 없이 로컬 셈으로. 고르면 전체 화면으로 들어간다.</p>
        <ul className="space-y-2">
          {PRESETS.map((p, i) => (
            <li key={p.label}>
              <button type="button" className="dg-btn dg-btn-steel min-h-[44px] w-full justify-start text-left text-sm" onClick={() => start(i)}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <DungeonView
      key={`${preset}-${round}`}
      status={statusOf(PRESETS[preset])}
      character={CHARACTER}
      mbti="ESTJ"
      strike={strike}
      onExit={() => (window.history.length > 1 ? navigate(-1) : setRound(0))}
      onReset={() => start(preset)}
    />
  );
}
