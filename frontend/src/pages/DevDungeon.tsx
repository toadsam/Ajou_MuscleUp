// 개발 전용: 던전 지도판을 서버 없이 돌려 본다(로그인 없음). strike 는 lib/shadow 의 로컬 셈(서버 ShadowRules 와 같은 규칙).
// App.tsx 에서 DEV 일 때만 라우트를 연다. 375px 폭도 여기서 본다. 지도 엔진은 window.__dungeon(DEV) 으로 위치 · 순간이동을 볼 수 있다.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DungeonMap, { type StrikeTarget } from "../components/dungeon/DungeonMap";
import type { StageCharacter } from "../components/workout/LiftStage";
import { defaultGrowthParams } from "../components/avatar/types";
import { PASSIVES, localStrike, type LocalWorld, type ShadowGrade, type ShadowHit, type ShadowMob, type ShadowSkill, type ShadowStatus } from "../lib/shadow";

const CHARACTER: StageCharacter = {
  avatarSeed: "dev-boss",
  tier: "GOLD",
  evolutionStage: 3,
  gender: "MALE",
  growthParams: { ...defaultGrowthParams, muscularityNormalized: 0.6, shoulderGrowth: 0.6 },
};

/** 서버 ShadowRules.MOBS 와 같은 이름 · 비율 · 조각 */
const MOB_DEFS = [
  { code: "TOMORROW", name: "내일부터", pct: 10, shards: 1 },
  { code: "MIDNIGHT_SNACK", name: "야식 슬라임", pct: 12, shards: 1 },
  { code: "SNOOZE", name: "알람 스누즈", pct: 10, shards: 1 },
  { code: "EXCUSE", name: "핑계", pct: 14, shards: 2 },
];

function mobsFor(bossHp: number, rare: boolean, killed: string[] = []): ShadowMob[] {
  const list = MOB_DEFS.map((d, i) => {
    const hp = Math.max(15, Math.round((bossHp * d.pct) / 100));
    const dead = killed.includes(d.code);
    return { id: 900 + i, code: d.code, name: d.name, slot: i, hp, remaining: dead ? 0 : hp, killed: dead, rare: false, shards: d.shards };
  });
  if (rare) {
    const hp = Math.max(15, Math.round(bossHp * 0.2));
    list.push({ id: 904, code: "SOFA", name: "소파 괴물", slot: 4, hp, remaining: hp, killed: false, rare: true, shards: 5 });
  }
  return list;
}

type Preset = { label: string; world: LocalWorld; stats: ShadowStatus["stats"]; rest?: boolean };

const PRESETS: Preset[] = [
  {
    label: "보통 주 — 통 5개 · 토큰 2 · 잡몹 4 + 희귀",
    world: { hp: 420, damage: 0, level: 14, charge: { LEGS: 150, CHEST: 60, BACK: 45, ARMS: 30, RUN: 104 }, critTokens: 2, passives: [PASSIVES.BIG_THREE, PASSIVES.LONG_RUN], killed: false, rewarded: false, nextId: 1, mobs: mobsFor(420, true) },
    stats: { strengthKg: 327, enduranceKm: 12.4, attendanceStreak: 9, weeklyStreak: 3, level: 14 },
  },
  {
    label: "첫 주 — 체력 100 · 하체 120 · 잡몹 15씩",
    world: { hp: 100, damage: 0, level: 1, charge: { LEGS: 120, CHEST: 0, BACK: 0, ARMS: 0, RUN: 0 }, critTokens: 0, passives: [], killed: false, rewarded: false, nextId: 1, mobs: mobsFor(100, false) },
    stats: { strengthKg: 140, enduranceKm: 0, attendanceStreak: 1, weeklyStreak: 0, level: 1 },
  },
  {
    label: "빈 통 — 운동 안 한 주(둘러보기만)",
    world: { hp: 100, damage: 0, level: 1, charge: { LEGS: 0, CHEST: 0, BACK: 0, ARMS: 0, RUN: 0 }, critTokens: 0, passives: [], killed: false, rewarded: false, nextId: 1, mobs: mobsFor(100, false) },
    stats: { strengthKg: 0, enduranceKm: 0, attendanceStreak: 0, weeklyStreak: 0, level: 1 },
  },
  {
    label: "보스 처치 뒤 — 잡몹 2마리 남음",
    world: { hp: 100, damage: 130, level: 5, charge: { LEGS: 0, CHEST: 40, BACK: 0, ARMS: 25, RUN: 0 }, critTokens: 1, passives: [PASSIVES.STEADY, PASSIVES.HUNTER], killed: true, rewarded: true, nextId: 1, mobs: mobsFor(100, false, ["TOMORROW", "SNOOZE"]) },
    stats: { strengthKg: 210, enduranceKm: 3.2, attendanceStreak: 4, weeklyStreak: 6, level: 5 },
  },
];

function statusOf(p: Preset): ShadowStatus {
  const w = p.world;
  return {
    name: "그림자",
    weekStart: "2026-10-19",
    weekEnd: "2026-10-25",
    rest: Boolean(p.rest),
    hp: w.hp,
    damage: w.damage,
    remaining: Math.max(0, w.hp - w.damage),
    killed: w.killed,
    killedAt: w.killed ? "2026-10-20T20:00:00" : null,
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
    mobs: w.mobs,
  };
}

const clone = (w: LocalWorld): LocalWorld => ({ ...w, charge: { ...w.charge }, mobs: w.mobs.map((m) => ({ ...m })) });

export default function DevDungeon() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState(0);
  const [round, setRound] = useState(0);
  const world = useRef<LocalWorld>(clone(PRESETS[0].world));

  const start = (i: number) => {
    world.current = clone(PRESETS[i].world);
    setPreset(i);
    setRound((r) => r + 1);
  };

  const strike = (target: StrikeTarget, skill: ShadowSkill, grade: ShadowGrade, crit: boolean): Promise<ShadowHit> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        const r = localStrike(world.current, skill, grade, crit, target);
        if (!r) {
          reject(new Error("통이 비었거나 이미 쓰러졌어요"));
          return;
        }
        world.current = r.world;
        resolve(r.hit);
      }, 120); // 서버 왕복 흉내
    });

  if (round === 0) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-20 pt-24 text-white">
        <h1 className="text-3xl">그림자 던전 지도 (개발)</h1>
        <p className="text-sm text-steel-400">서버 없이 로컬 셈으로. 고르면 전체 화면 지도로 들어간다. 조이스틱 · 방향키 · WASD · 바닥 탭으로 걷고, 몬스터에 닿으면 전투.</p>
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
    <DungeonMap
      key={`${preset}-${round}`}
      status={statusOf({ ...PRESETS[preset], world: world.current })}
      character={CHARACTER}
      mbti="ESTJ"
      strike={strike}
      onExit={() => (window.history.length > 1 ? navigate(-1) : setRound(0))}
      onReset={() => start(preset)}
    />
  );
}
